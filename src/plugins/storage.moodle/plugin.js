const contentPath = 'content/';

export class StorageMoodle {

    constructor(app) {
        this.app = app;
        this.name = 'MoodleStorage';
        //initialize store
        this.initializeStore();
    }

    initializeStore() {
    }

    /**
     * To get a list of template categories.
     *
     * @param {number} d The desired diameter of the circle.
     * @return {Promise<Array<{value, text}>>} A Promise that resolves to an array of objects with value and text properties.
     */
    getTemplateCategories() {
        var categories = [];
        if (typeof(TepuyAPI) != 'undefined') {

            for (var index in TepuyAPI.categories) {
                var cat = {
                    value: TepuyAPI.categories[index].key,
                    text: TepuyAPI.categories[index].label
                }
                categories.push(cat);
            }
        }

        return Promise.resolve(categories);

    }

    /**
    * To get a list of templates.
    *
    * @param {{categories:string[],keyword:string}} filter An object to indicate how to filter templates.
    * If no categories, no keyword all templates are expected.
    * @return {Promise<Array<Template>>} A Promise that resolves to an array of template objects: {}.
    */
    getTemplates(filter) {

        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve([]);
        }

        return TepuyAPI.getTemplatesPromise(filter);
    }

    /**
    * To get a list of objects.
    *
    * @param {{keyword:string}} filter An object to indicate how to filter categories. If no keyword all templates are expected.
    * @return {Promise<Array<Object>>} A Promise that resolves to an array of objects: {}.
    */
    getObjects(filter) {

        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve([]);
        }

        var metas = [{'key': 'access.username', 'value': TepuyAPI.currentuser.username}]

        return TepuyAPI.getObjectsPromise(filter, metas);
    }

    /**
    * To persist and object information.
    *
    * @param {Object} dco The object manifest to save.
    * @return {Promise<Object>} A Promise that resolves to the saved object.
    */
    getSpecList() {
        var specs = [];
        if (typeof(TepuyAPI) != 'undefined') {
            specs = TepuyAPI.specs;
        }

        return Promise.resolve(specs);
    }

    /**
     *
     * @param {string} id Spec key
     * @return {Promise<Object>} A Promise that resolves to the spec XML.
     */
    getSpec(id) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.reject('Specification not available');
        }

        return TepuyAPI.getSpecPromise(id);
    }

    /**
    * To persist an object information.
    *
    * @param {Object} dco The object manifest to save.
    * @return {Promise<Object>} A Promise that resolves to the saved object.
    */
    save(dco, publish) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve([]);
        }

        return TepuyAPI.savePromise(dco, publish);
    }

    /**
    * To delete an object.
    *
    * @param {Object} dco The object to delete.
    * @return {Promise<result>} A Promise that resolves to the result of the delete operation. true for success.
    */
   delete(dco) {
        if (!dco.id || typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve(false);
        }

        return TepuyAPI.deletePromise(dco);
    }

    /**
    * To download an object.
    *
    * @param {Object} dco The object manifest to download. { id: string }
    * @return {Promise<string>} A Promise that resolves to a URL string to download the zip file.
    */
    download(dco) {
        if (!dco.id || typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve(false);
        }

        return TepuyAPI.downloadPromise(dco.id);
    }

    /**
    * To get a list of resources belonging to an object in a given path.
    *
    * @param {Object} dco The object manifest to get resources for.
    * @param {string} path The path inside the object to get resources for, use / to get the root resources.
    * @return {Promise<Array<Object>>} A Promise that resolves to an array of resource objects: {
        name: string,
        type: 'D'|'F', //D: directory, F: file
        path: string, //Relative to the object root
        createdAt: timestamp, //Date
        isDro: boolean, //true|false Is a Digital Resource object
        size: number, //Size only if it is file
        extension: string, //
        thumbnail: string //Path to the preview if image
    }
    */
    getResources(dco, path) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        if (path == '' || path == '/') {
            path = contentPath;
        }

        return TepuyAPI.lsPromise(dco.id, path);
    }

    /**
    * To add a resource to an object.
    *
    * @param {Object} dco The object manifest where the resource will be added. { id: string }
    * @param {Object} res The object resource that will be saved. {
            type: 'F'|'D',
            name: string,
            createdAt: timestamp,
            //Type 'F' only
            size: number,
            extension: string,
            blob: Blob
    }
    * @param {string} path The path for the resource parent.
    * @return {Promise<Object>} A Promise that resolves to new created resource.
    */
    addResource(dco, res, path) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        if (path == '' || path == '/') {
            path = contentPath;
        } else {
            path = path + '/';
        }

        var isdir = res.type == 'D';
        var filename = path + res.name;
        return TepuyAPI.saveFilePromise(dco.id, filename, res.blob, isdir, true);
    }

    /**
    * To rename a resource that belongs to an object.
    *
    * @param {Object} dco The object manifest the resource belongs to. { id: string }
    * @param {Object} res The resource object that will be renamed. { id: string }
    * @param {string} newname The new name to be set on the resource.
    * @return {Promise<Object>} A Promise that resolves to the renamed resource object.
    */
    renameResource(dco, res, newname) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        var parts = res.path.split('/');

        var oldname = parts.pop();
        var oldpath = parts.join('/');

        return TepuyAPI.mvPromise(dco.id, oldpath, oldname, oldpath, newname);
    }

    /**
    * To delete a resource from an object
    *
    * @param {Object} dco The object manifest the resource belongs to. { id: string }
    * @return {Promise<result>} A Promise that resolves to the result of the delete operation. true for success.
    */
    deleteResource(dco, path) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.rmPromise(dco.id, path);
    }


    /**
    * To get the html content of the index page for a given object.
    *
    * @param {Object} dco The object manifest to download. { id: string }
    * @return {Promise<string>} A Promise that resolves to a base64 string that represents the html content of the object index page.
    */
    getIndex(dco) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.getContentPromise(dco.id, 'index.html');
    }

    /**
    * To update the html content of the index page for a given object
    *
    * @param {Object} dco The object manifest to download. { id: string }
    * @param {string} index Base64 string that represents the index page content
    * @return {Promise<result>} A Promise that resolves to the result of the update operation. true for success.
    */
    updateIndex(dco, index) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.saveFilePromise(dco.id, 'index.html', index);
    }

    /**
    * To get the html content of the content page for a given object.
    *
    * @param {Object} dco The object manifest to download. { id: string }
    * @return {Promise<string>} A Promise that resolves to a base64 string that represents the html content of the object index page.
    */
    getContent(dco) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.getContentPromise(dco.id, 'content.html');
    }

    /**
    * To update the html content of the content page for a given object
    *
    * @param {Object} dco The object manifest to download. { id: string }
    * @param {string} content Base64 string that represents the content page content
    * @return {Promise<result>} A Promise that resolves to the result of the update operation. true for success.
    */
    updateContent(dco, content) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.saveFilePromise(dco.id, 'content.html', content);
    }

    /**
     * To initialize a new DCO based in a template.
     *
     * @param {Object} properties The properties to create the object. { templateId, name, type, shareWith }
     * @return {Promise<dco>} A Promise that resolves to the result of the create operation.
     */
    createObject(properties) {
        if (typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve('');
        }

        return TepuyAPI.createObjectPromise(properties.templateId, properties.name, properties.type, properties.shareWith);
    }

    /**
     *
     * @param {*} dco
     * @param {Object} user {email, role}
     */
    grantAccess(dco, user) {
        if (!dco.id || typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve(false);
        }

        return TepuyAPI.accessAddPromise(dco.id, [ { 'email': user.email, 'role': user.role }]);
    }

    revokeAccess(dco, user) {
        if (!dco.id || typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve(false);
        }

        return TepuyAPI.accessRevokePromise(dco.id, [ user.email ]);
    }

    updateAccess(dco, user) {
        if (!dco.id || typeof(TepuyAPI) == 'undefined') {
            return Promise.resolve(false);
        }

        return TepuyAPI.accessAddPromise(dco.id, [ { 'email': user.email, 'role': user.role }]);
    }
}
