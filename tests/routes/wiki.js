// ---------------------------------------------------------------------------------------------------------------------
// Unit Tests for the accounts module.
//
// @module
// ---------------------------------------------------------------------------------------------------------------------

const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);

// Setup Logging
process.env.LOG_LEVEL = 'ERROR';

// Setup Database
const dbMan = require('../../server/database');
dbMan.testing = true;

// Setup config
const configMan = require('../../server/managers/config');
configMan.set('overrideAuth', true);
configMan.set('http.port', undefined);

// Managers
const accountMan = require('../../server/managers/account');

// Server
const { app, listen } = require('../../server');

// ---------------------------------------------------------------------------------------------------------------------

let db;

// Start the server
const server = listen();
const request = chai.request(server);
const { expect } = chai;

// ---------------------------------------------------------------------------------------------------------------------

describe("Wiki API ('/wiki')", () =>
{
    beforeEach(() =>
    {
        return dbMan.getDB()
            .then((testDB) => db = testDB)
            .then(() => accountMan.getAccountByUsername('globalAdmin').then((user) => app.set('user', user)));
    });

    afterEach(() =>
    {
        // Clear the database between runs
        return db.seed.run({ directory: './tests/seeds' });
    });

    describe('HEAD /wiki/:path', () =>
    {
        it('the existence of a page can be checked without getting the entire page.', () =>
        {
            return request.head('/wiki')
                .set('Accept', 'application/json')
                .then((response) =>
                {
                    const json = response.body;
                    expect(json).to.be.empty;
                });
        });

        it("requesting a page that doesn't exist returns a 404", () =>
        {
            return request.head('/wiki/dne')
                .set('Accept', 'application/json')
                .catch(({ response }) => response)
                .then((response) =>
                {
                    expect(response).to.have.status(404);
                });
        });

        describe('Permissions', () =>
        {
            it("requesting a page the user doesn't have permission to view returns a 403", () =>
            {
                return accountMan.getAccountByUsername('normalUser')
                    .then((user) => app.set('user', user))
                    .then(() =>
                    {
                        return request.head('/wiki/perm')
                            .set('Accept', 'application/json')
                            .catch(({ response }) => response)
                            .then((response) =>
                            {
                                expect(response).to.have.status(403);
                            });
                    });
            });
        });
    });

    describe('GET /wiki/:path', () =>
    {
        it('returns the current revision of the page', () =>
        {
            return request.get('/wiki/normal')
                .set('Accept', 'application/json')
                .then((response) =>
                {
                    expect(response).to.be.json;

                    const page = response.body;
                    expect(page).to.be.an('object');
                    expect(page).to.not.be.empty;

                    expect(page).to.have.property('page_id');
                    expect(page).to.have.property('path', '/normal');
                    expect(page).to.have.property('title', 'Normal Wiki Page');
                    expect(page).to.have.property('body');
                    expect(page).to.have.property('created');
                    expect(page).to.have.property('edited');
                    expect(page).to.have.property('revision_id');

                    const actions = page.actions;
                    expect(actions).to.be.an('object');
                    expect(actions).to.not.be.empty;
                    expect(actions).to.have.property('wikiView', '*');
                    expect(actions).to.have.property('wikiModify', '*');
                })
                .then(() => accountMan.getAccountByUsername('normalUser').then((user) => app.set('user', user)))
                .then(() =>
                {
                    return request.get('/wiki/normal')
                        .set('Accept', 'application/json')
                        .then((response) =>
                        {
                            expect(response).to.be.json;

                            const page = response.body;
                            expect(page).to.be.an('object');
                            expect(page).to.not.be.empty;

                            expect(page).to.have.property('page_id');
                            expect(page).to.have.property('path', '/normal');
                            expect(page).to.have.property('title', 'Normal Wiki Page');
                            expect(page).to.have.property('body');
                            expect(page).to.have.property('created');
                            expect(page).to.have.property('edited');
                            expect(page).to.have.property('revision_id');

                            const actions = page.actions;
                            expect(actions).to.be.an('object');
                            expect(actions).to.not.be.empty;
                            expect(actions).to.have.property('wikiView', '*');
                            expect(actions).to.have.property('wikiModify', '*');
                        });
                });
        });

        it('pages can be hierarchical, separated by `/`', () =>
        {
            return request.get('/wiki/normal/sub')
                .set('Accept', 'application/json')
                .then((response) =>
                {
                    expect(response).to.be.json;

                    const page = response.body;
                    expect(page).to.be.an('object');
                    expect(page).to.not.be.empty;

                    expect(page).to.have.property('page_id');
                    expect(page).to.have.property('path', '/normal/sub');
                    expect(page).to.have.property('title', 'Sub Wiki Page');
                    expect(page).to.have.property('body');
                    expect(page).to.have.property('created');
                    expect(page).to.have.property('edited');
                    expect(page).to.have.property('revision_id');

                    const actions = page.actions;
                    expect(actions).to.be.an('object');
                    expect(actions).to.not.be.empty;
                    expect(actions).to.have.property('wikiView', '*');
                    expect(actions).to.have.property('wikiModify', '*');
                })
                .then(() => accountMan.getAccountByUsername('normalUser').then((user) => app.set('user', user)))
                .then(() =>
                {
                    return request.get('/wiki/normal/sub')
                        .set('Accept', 'application/json')
                        .then((response) =>
                        {
                            expect(response).to.be.json;

                            const page = response.body;
                            expect(page).to.be.an('object');
                            expect(page).to.not.be.empty;

                            expect(page).to.have.property('page_id');
                            expect(page).to.have.property('path', '/normal/sub');
                            expect(page).to.have.property('title', 'Sub Wiki Page');
                            expect(page).to.have.property('body');
                            expect(page).to.have.property('created');
                            expect(page).to.have.property('edited');
                            expect(page).to.have.property('revision_id');

                            const actions = page.actions;
                            expect(actions).to.be.an('object');
                            expect(actions).to.not.be.empty;
                            expect(actions).to.have.property('wikiView', '*');
                            expect(actions).to.have.property('wikiModify', '*');
                        });
                });
        });

        it("requesting a page that doesn't exist returns a 404", () =>
        {
            return request.get('/wiki/dne')
                .set('Accept', 'application/json')
                .catch(({ response }) => response)
                .then((response) =>
                {
                    expect(response).to.have.status(404);
                });
        });

        describe('Permissions', () =>
        {
            it('only returns pages that are visible to the user', () =>
            {
                return request.get('/wiki/normal/sub/perm')
                    .set('Accept', 'application/json')
                    .then((response) =>
                    {
                        expect(response).to.be.json;

                        const page = response.body;
                        expect(page).to.be.an('object');
                        expect(page).to.not.be.empty;

                        expect(page).to.have.property('page_id');
                        expect(page).to.have.property('path', '/normal/sub/perm');
                        expect(page).to.have.property('title', 'Perm Sub Wiki Page');
                        expect(page).to.have.property('body');
                        expect(page).to.have.property('created');
                        expect(page).to.have.property('edited');
                        expect(page).to.have.property('revision_id');

                        const actions = page.actions;
                        expect(actions).to.be.an('object');
                        expect(actions).to.not.be.empty;
                        expect(actions).to.have.property('wikiView', 'special');
                        expect(actions).to.have.property('wikiModify', 'special');
                    })
                    .then(() => accountMan.getAccountByUsername('normalUser').then((user) => app.set('user', user)))
                    .then(() =>
                    {
                        return request.get('/wiki/normal/sub/perm')
                            .set('Accept', 'application/json')
                            .catch(({ response }) => response)
                            .then((response) =>
                            {
                                expect(response).to.have.status(403);
                            });
                    });
            });

            it("inherits the permissions from it's parent page", () =>
            {
                return request.get('/wiki/normal/sub/perm/inherited')
                    .set('Accept', 'application/json')
                    .then((response) =>
                    {
                        expect(response).to.be.json;

                        const page = response.body;
                        expect(page).to.be.an('object');
                        expect(page).to.not.be.empty;

                        expect(page).to.have.property('page_id');
                        expect(page).to.have.property('path', '/normal/sub/perm/inherited');
                        expect(page).to.have.property('title', 'Inherited Perm Sub Wiki Page');
                        expect(page).to.have.property('body');
                        expect(page).to.have.property('created');
                        expect(page).to.have.property('edited');
                        expect(page).to.have.property('revision_id');

                        const actions = page.actions;
                        expect(actions).to.be.an('object');
                        expect(actions).to.not.be.empty;
                        expect(actions).to.have.property('wikiView', 'special');
                        expect(actions).to.have.property('wikiModify', 'special');
                    })
                    .then(() => accountMan.getAccountByUsername('normalUser').then((user) => app.set('user', user)))
                    .then(() =>
                    {
                        return request.get('/wiki/normal/sub/perm/inherited')
                            .set('Accept', 'application/json')
                            .catch(({ response }) => response)
                            .then((response) =>
                            {
                                expect(response).to.have.status(403);
                            });
                    });
            });
        });
    });

    //TODO: Pull out into it's own tests.
    describe('GET /history/:path', () =>
    {
        xit('returns the entire revision history of the page', () =>
        {

        });

        xit("requesting a page that doesn't exist returns a 404", () =>
        {

        });

        describe('Permissions', () =>
        {
            xit('only returns history for pages that are visible to the user', () =>
            {

            });
        });
    });

    describe('PUT /wiki/:path', () =>
    {
        it('logged in users can create new pages', () =>
        {
            const newPage = { path: "/bar", title: "Bar Page", body: "The bar page." };

            return accountMan.getAccountByUsername('normalUser')
                .then((user) => app.set('user', user))
                .then(() =>
                {
                    return request.put('/wiki/bar')
                        .set('Accept', 'application/json')
                        .send(newPage)
                        .then((response) =>
                        {
                            expect(response).to.be.json;

                            const page = response.body;
                            expect(page).to.be.an('object');
                            expect(page).to.not.be.empty;

                            expect(page).to.have.property('page_id');
                            expect(page).to.have.property('path', '/bar');
                            expect(page).to.have.property('title', 'Bar Page');
                            expect(page).to.have.property('body');
                            expect(page).to.have.property('created');
                            expect(page).to.have.property('edited');
                            expect(page).to.have.property('revision_id');

                            const actions = page.actions;
                            expect(actions).to.be.an('object');
                            expect(actions).to.not.be.empty;
                            expect(actions).to.have.property('wikiView', '*');
                            expect(actions).to.have.property('wikiModify', '*');

                            // Attempt to look up the page we just created
                            return request.get('/wiki/bar')
                                .set('Accept', 'application/json')
                                .then((response) =>
                                {
                                    expect(response).to.be.json;

                                    const page = response.body;
                                    expect(page).to.be.an('object');
                                    expect(page).to.not.be.empty;

                                    expect(page).to.have.property('page_id');
                                    expect(page).to.have.property('path', '/bar');
                                    expect(page).to.have.property('title', 'Bar Page');
                                    expect(page).to.have.property('body');
                                    expect(page).to.have.property('created');
                                    expect(page).to.have.property('edited');
                                    expect(page).to.have.property('revision_id');

                                    const actions = page.actions;
                                    expect(actions).to.be.an('object');
                                    expect(actions).to.not.be.empty;
                                    expect(actions).to.have.property('wikiView', '*');
                                    expect(actions).to.have.property('wikiModify', '*');
                                });
                        });
                });
        });

        it('anonymous users can not create new pages', () =>
        {
            const newPage = { path: "/bar", title: "Bar Page", body: "The bar page." };
            app.set('user', null);

            return request.put('/wiki/bar')
                .set('Accept', 'application/json')
                .send(newPage)
                .catch(({ response }) => response)
                .then((response) =>
                {
                    expect(response).to.have.status(401);
                });
        });

        it('fails to create a new page if one exists', () =>
        {
            const newPage = { path: "/normal", title: "Bar Page", body: "The bar page." };

            return request.put('/wiki/normal')
                .set('Accept', 'application/json')
                .send(newPage)
                .catch(({ response }) => response)
                .then((response) =>
                {
                    expect(response).to.have.status(409);
                });
        });

        describe('Permissions', () =>
        {
            it('only allows creation of pages if the user is allowed to modify the parent page', () =>
            {
                const newPage = { path: "/normal/sub/perm/bar", title: "Bar Page", body: "The bar page." };

                return accountMan.getAccountByUsername('normalUser')
                    .then((user) => app.set('user', user))
                    .then(() =>
                    {
                        return request.put('/wiki/normal/sub/perm/bar')
                            .set('Accept', 'application/json')
                            .send(newPage)
                            .catch(({ response }) => response)
                            .then((response) => {
                                expect(response).to.have.status(403);
                            })
                            .then(() => accountMan.getAccountByUsername('specialUser').then((user) => app.set('user', user)))
                            .then(() =>
                            {
                                return request.put('/wiki/bar')
                                    .set('Accept', 'application/json')
                                    .send(newPage)
                                    .then((response) =>
                                    {
                                        expect(response).to.be.json;

                                        const page = response.body;
                                        expect(page).to.be.an('object');
                                        expect(page).to.not.be.empty;

                                        expect(page).to.have.property('page_id');
                                        expect(page).to.have.property('path', '/bar');
                                        expect(page).to.have.property('title', 'Bar Page');
                                        expect(page).to.have.property('body');
                                        expect(page).to.have.property('created');
                                        expect(page).to.have.property('edited');
                                        expect(page).to.have.property('revision_id');

                                        const actions = page.actions;
                                        expect(actions).to.be.an('object');
                                        expect(actions).to.not.be.empty;
                                        expect(actions).to.have.property('wikiView', '*');
                                        expect(actions).to.have.property('wikiModify', '*');

                                        // Attempt to look up the page we just created
                                        return request.get('/wiki/bar')
                                            .set('Accept', 'application/json')
                                            .then((response) =>
                                            {
                                                expect(response).to.be.json;

                                                const page = response.body;
                                                expect(page).to.be.an('object');
                                                expect(page).to.not.be.empty;

                                                expect(page).to.have.property('page_id');
                                                expect(page).to.have.property('path', '/bar');
                                                expect(page).to.have.property('title', 'Bar Page');
                                                expect(page).to.have.property('body');
                                                expect(page).to.have.property('created');
                                                expect(page).to.have.property('edited');
                                                expect(page).to.have.property('revision_id');

                                                const actions = page.actions;
                                                expect(actions).to.be.an('object');
                                                expect(actions).to.not.be.empty;
                                                expect(actions).to.have.property('wikiView', '*');
                                                expect(actions).to.have.property('wikiModify', '*');
                                            });
                                    });
                            });
                    });
            });
        });
    });

    describe('POST /wiki/:path', () =>
    {
        it('editing a page generates a new revision', () =>
        {
            const newEdit = { title: 'Edited Title', body: 'This is an edited page.' };
            return request.get('/wiki/normal')
                .set('Accept', 'application/json')
                .then((data) =>
                {
                    const page = data.body;

                    // We need to save the current revision number to save this correctly.
                    newEdit.revision_id = page.revision_id;

                    return request.post('/wiki/normal')
                        .set('Accept', 'application/json')
                        .send(newEdit)
                        .then((response) =>
                        {
                            expect(response).to.be.json;

                            const page = response.body;
                            expect(page).to.be.an('object');
                            expect(page).to.not.be.empty;

                            expect(page).to.have.property('page_id');
                            expect(page).to.have.property('title', newEdit.title);
                            expect(page).to.have.property('body', newEdit.body);
                            expect(page).to.have.property('revision_id', newEdit.revision_id + 1);

                            // Attempt to look up the page we just created
                            return request.get('/wiki/normal')
                                .set('Accept', 'application/json')
                                .then((response) =>
                                {
                                    expect(response).to.be.json;

                                    const page = response.body;
                                    expect(page).to.be.an('object');
                                    expect(page).to.not.be.empty;

                                    expect(page).to.have.property('page_id');
                                    expect(page).to.have.property('title', newEdit.title);
                                    expect(page).to.have.property('body', newEdit.body);
                                    expect(page).to.have.property('revision_id', newEdit.revision_id + 1);
                                });
                        });
                });
        });

        xit('edits are refused if other edits have happened since this edit was started', () =>
        {

        });

        xit("editing a page that doesn't exist returns a 404", () =>
        {

        });

        describe('Permissions', () =>
        {
            xit('only allows edits if the user has the appropriate permission', () =>
            {

            });

            xit("inherits the permissions from it's parent page", () =>
            {

            });
        });
    });

    describe('DELETE /wiki/:path', () =>
    {
        xit("deleting a page completely removes it's history", () =>
        {

        });

        xit("deleting a page that doesn't exist returns a 404", () =>
        {

        });

        describe('Permissions', () =>
        {
            xit('only allows deletes if the user has the appropriate permission for editing', () =>
            {

            });

            xit("inherits the permissions from it's parent page", () =>
            {

            });
        });
    });
});

// ---------------------------------------------------------------------------------------------------------------------
