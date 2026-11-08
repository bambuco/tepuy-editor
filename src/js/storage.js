export class Storage {
    constructor(impl) {
        this._name = impl.name ||'';
        this._impl = impl;
    }

    getTemplateCategories() {
        this._checkImplementation('getTemplateCategories');
        return this._impl.getTemplateCategories();
    }

    getTemplates(filter) {
        this._checkImplementation('getTemplates');
        return this._impl.getTemplates(filter);
    }

    getObject(id) {
        this._checkImplementation('getObject');
        return this._impl.getObject(id);
    }

    getObjects(filter) {
        this._checkImplementation('getObjects');
        return this._impl.getObjects(filter);
    }

    getSpecList() {
        this._checkImplementation('getSpecList');
        return this._impl.getSpecList();
    }

    getSpec(id) {
        this._checkImplementation('getSpec');
        return this._impl.getSpec(id);
    }

    createObject(properties) {
        this._checkImplementation('createObject');
        return this._impl.createObject(properties);
    }

    save(dco) {
        this._checkImplementation('save');
        return this._impl.save(dco);
    }

    delete(dco) {
        this._checkImplementation('delete');
        return this._impl.delete(dco);
    }

    download(dco) {
        this._checkImplementation('download');
        return this._impl.download(dco);
    }

    getResources(dco, path) {
        this._checkImplementation('getResources');
        return this._impl.getResources(dco, path);
    }

    addResource(dco, res, path) {
        this._checkImplementation('addResource');
        return this._impl.addResource(dco, res, path);
    }

    renameResource(dco, res, newName) {
        this._checkImplementation('renameResource');
        return this._impl.renameResource(dco, res, newName);
    }

    deleteResource(dco, path) {
        this._checkImplementation('deleteResource');
        return this._impl.deleteResource(dco, path);
    }

    getIndex(dco) {
        this._checkImplementation('getIndex');
        return this._impl.getIndex(dco);
    }

    updateIndex(dco, index) {
        this._checkImplementation('updateIndex');
        return this._impl.updateIndex(dco, index);
    }

    getContent(dco) {
        this._checkImplementation('getContent');
        return this._impl.getContent(dco);
    }

    updateContent(dco, content) {
        this._checkImplementation('updateContent');
        return this._impl.updateContent(dco, content);
    }

    share(dco) {
        this._checkImplementation('share');
        return this._impl.share(dco);
    }

    grantAccess(dco, user) {
        this._checkImplementation('grantAccess');
        return this._impl.grantAccess(dco, user);
    }

    revokeAccess(dco, user) {
        this._checkImplementation('revokeAccess');
        return this._impl.revokeAccess(dco, user);
    }

    updateAccess(dco, user) {
        this._checkImplementation('updateAccess');
        return this._impl.updateAccess(dco, user);
    }

     /*
    "Private" methods
    */
    _checkImplementation(method){
        if (!(method in this._impl)) {
            throw this._name + 'storage plugin is missing ' + method + ' method';
        }
    }

}