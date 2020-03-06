export class Api {
    constructor(api) {
        if (typeof(api) == 'string') {
            this.initWebApi(api);
        }
        else {
            this.initObjApi(api);
        }
    }

    initWebApi(apiUrl) {
        //ToDo: implement webApi wrapper
    }

    initObjApi(apiObj) {
        this._api = apiObj || {};
    }

    call(method, params = null) {
        if (method in this._api) {
            return this._api[method].apply(this._api, [params]);
        }
        console.log("Api method '" + method + "' doesn't exist");
        return null;
    }
}