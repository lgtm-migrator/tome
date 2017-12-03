//----------------------------------------------------------------------------------------------------------------------
// WikiResourceAccess.js
//
// @module
//----------------------------------------------------------------------------------------------------------------------

const _ = require('lodash');
const Promise = require('bluebird');

const dbMan = require('../database');
const { AppError, NotFoundError, MultipleResultsError, ValidationError } = require('../errors');

//----------------------------------------------------------------------------------------------------------------------

class WikiResourceAccess
{
    constructor()
    {
        this.loading = dbMan.getDB();
    } // end constructor

    //------------------------------------------------------------------------------------------------------------------
    // Utility Functions
    //------------------------------------------------------------------------------------------------------------------

    _mungeWikiPage(page)
    {
        page.created = new Date(page.created);
        page.edited = new Date(page.edited);

        page.actions = {
            wikiView: page.action_view === 'inherit' ? this._getPermission(page.path, 'view') : page.action_view,
            wikiModify: page.action_modify === 'inherit' ? this._getPermission(page.path, 'modify') : page.action_modify,
        };

        delete page.action_view;
        delete page.action_modify;

        return Promise.props(page.actions)
            .then((actions) =>
            {
                page.actions = actions;
                return page;
            });
    } // end _mungeWikiPage

    _getPermission(path, action)
    {
        return this.loading
            .then((db) => db
            .with('page_ancestors',
                db.raw('select * from page where instr(?, path) order by length(path) desc', [path])
            )
            .from('page_ancestors')
            .distinct()
            .select(`action_${ action } as ${ action }`)
            .whereNot(`action_${ action }`, 'inherit')
            .limit(1)
            .then(([ permObj ]) => permObj[action]));
    } // end _getPermission

    //------------------------------------------------------------------------------------------------------------------
    // Public API
    //------------------------------------------------------------------------------------------------------------------

    createPage(page)
    {
        return this.loading
            .then((db) => db.transaction((trans) =>
                {
                    return db('page')
                        .transacting(trans)
                        .insert(_.pick(page, 'title', 'path', 'action_view', 'action_modify'))
                        .then(([ newPageID ]) =>
                        {
                            return db('revision')
                                .transacting(trans)
                                .insert(_.pick({ page_id: newPageID, body: page.body }));
                        })
                        .then(() => trans.commit())
                        .catch((error) =>
                        {
                            console.error(`Failed to create page '${ page.path }':`, error.stack);

                            // Rollback the transaction
                            trans.rollback();

                            // Throw a generic error, because we want the outside code to know this didn't work,
                            // but we don't want to expose the details.
                            throw AppError(`Failed to create page '${ page.path }'.`);
                        });
                })
            );
    } // end createPage

    getPage(path)
    {
        return this.loading
            .then((db) => db('current_revision')
            .select()
            .where({ path })
            .then((pages) =>
            {
                if(pages.length > 1)
                {
                    throw new MultipleResultsError('page');
                }
                else if(pages.length === 0)
                {
                    throw new NotFoundError(`No page found for url '${ path }'.`);
                }
                else
                {
                    return this._mungeWikiPage(pages[0]);
                } // end if
            }));
    } // end getPage

    updatePage(newPage)
    {
        return this.loading
            .then((db) => db('current_revision')
            .select('page_id', 'path', 'title', 'revision_id')
            .where({ page_id: newPage.page_id })
            .then(([ currentPage ]) =>
            {
                if(!currentPage)
                {
                    throw new NotFoundError(`No page found for id '${ newPage.page_id }'.`);
                }
                else if(newPage.path !== currentPage.path)
                {
                    throw new ValidationError('path', "Updating 'path' must be done as it's own operation.");
                }
                else
                {
                    return db.transaction((trans) =>
                    {
                        return db('page')
                            .transacting(trans)
                            .where({ page_id: currentPage.page_id })
                            .update(_.pick(newPage, 'title', 'action_view', 'action_modify'))
                            .then(() =>
                            {
                                if(newPage.body && currentPage.body !== newPage.body)
                                {
                                    if(!_.isUndefined(newPage.revision_id) && currentPage.revision_id !== newPage.revision_id)
                                    {
                                        throw new ValidationError(
                                            'revision_id',
                                            "this revision is not the current 'revision_id'. Your chances may be against an outdated version."
                                        );
                                    }
                                    else
                                    {
                                        return this.addRevision(newPage.page_id, newPage.body, trans);
                                    } // end if
                                } // end if
                            })
                            .then(() => trans.commit())
                            .catch((error) =>
                            {
                                console.error(`Failed to update page '${ newPage.path }':`, error.stack);

                                // Rollback the transaction
                                trans.rollback();

                                // Throw a generic error, because we want the outside code to know this didn't work,
                                // but we don't want to expose the details.
                                throw AppError(`Failed to update page '${ newPage.path }'.`);
                            });
                    });
                } // end if
            }));
    } // end updatePage

    movePage(oldPath, newPath)
    {
        return this.loading
            .then((db) => db('page')
            .where({ path: oldPath })
            .update({ path: newPath })
            .then((rows) => ({ rowsAffected: rows })));
    } // end movePage

    deletePage(path)
    {
        return this.loading
            .then((db) => db('page')
            .select('page_id')
            .where({ path })
            .then((pages) =>
            {
                if(pages.length > 1)
                {
                    throw new MultipleResultsError('page');
                }
                else if(pages.length === 0)
                {
                    throw new NotFoundError(`No page found for url '${ path }'.`);
                }
                else
                {
                    const page = pages[0];

                    // We will consider `null` as the text for `body` to mean the page was deleted.
                    return this.addRevision(page.page_id, null);
                } // end if
            }));
    } // end movePage

    fullDeletePage(path)
    {
        // This will delete all revisions and comments.
        return this.loading
            .then((db) => db('page')
            .where({ path })
            .delete()
            .then((rows) => ({ rowsAffected: rows })));
    } //end fullDeletePage

    addRevision(page_id, body, transObj)
    {
        if(_.isUndefined(body))
        {
            // We coerce `undefined` to empty string, so that `null` can explicitly mean 'I deleted this page.'
            body = '';
        } // end if

        return this.loading
            .then((db) =>
            {
                const query = db('revision')
                    .insert({ body, page_id });

                if(transObj)
                {
                    query.transacting(transObj);
                } // end if

                return query
                    .then(([ id ]) => ({ id }));
            });
    } // end addRevision

    getRevisions(page_id)
    {
        return this.loading
            .then((db) => db('revision')
            .select()
            .where({ page_id }));
    } // end getRevisions
} // end WikiResourceAccess.js

//----------------------------------------------------------------------------------------------------------------------

module.exports = new WikiResourceAccess();

//----------------------------------------------------------------------------------------------------------------------
