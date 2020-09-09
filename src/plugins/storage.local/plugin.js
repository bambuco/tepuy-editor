import { templates } from './templates';

const empty = {
    id:'0',
    preview:'',
    description: "Plantilla en blanco",
    createdAt: '',
    name:'En blanco',
    category:'',
    license:'GPL',
    createdBy:"",
    url: "",
    baseUrl: 'https://tepuy.bambuco.co/rutatic/plantilla/'
};

const store = window.localStorage;
const categories = ['Category 1', 'Category 2', 'Category 3'];
const collections = {};

function getCollection(name, defaultValue) {
    if (!collections[name]) {
        collections[name] = readStoreKey(name, defaultValue);
    }
    return collections[name];
}

function readStoreKey(key, defaultValue = null) {
    let value = store.getItem(key);
    if (!value && defaultValue) {
        value = defaultValue;
        updateStoreKey(key, defaultValue);
    }
    else {
        value = JSON.parse(value);
    }
    return value;
}

function updateStoreKey(key, value) {
    store.setItem(key, JSON.stringify(value));
}

export class StorageLocal {
    constructor(app) {
        this.app = app;
        this.name = 'LocalStorage';
        //initialize store
        this.initializeStore();
    }

    initializeStore() {
    }

    getTemplateCategories() {
        return Promise.resolve(categories);
    }

    getTemplates(filter) {
        return Promise.resolve([empty, ...templates.filter(item => {
            var matchCat = null;
            if (filter.categories && filter.categories.length) {
                matchCat = filter.categories.indexOf(item.category) >= 0;
            }

            var matchKeyword = null;
            if (filter.keyword && filter.keyword != '') {
                var re = new RegExp(filter.keyword, 'i');
                matchKeyword = re.test(item.description) || re.test(item.name)  || re.test(item.category);
            }

            return (matchKeyword == null || matchKeyword) && (matchCat == null || matchCat);
        })]);
    }

    getObjects(filter) {
        return Promise.resolve(getCollection('objects', []));
    }

    getSpecList() {
        const specs = [
            { id: 'rea', name: 'Recurso educativo abierto' },
            { id: 'obi', name: 'Objeto informativo' },
            { id: 'red', name: 'Recurso digital' }
        ];

        return Promise.resolve(specs);
    }

    save(dco) {
        let objects = getCollection('objects');
        if (!dco.id) {
            dco.id = 'dco_' + (new Date().getTime());
        }

        let index = objects.findIndex(o => o.id == dco.id);
        if (index >= 0) {
            objects[index] = dco;
        }
        else {
            objects.push(dco);
        }
        updateStoreKey('objects', objects);
        return Promise.resolve(dco);
    }

    delete(dco) {
        if (!dco.id) return;
        let objects = getCollection('objects');
        let index = objects.findIndex(o => o.id == dco.id);
        console.log(index);
        console.log(dco);
        if (index >= 0) {
            objects.splice(index, 1);
            updateStoreKey('objects', objects);
            return Promise.resolve(dco);
        }
        return Promise.resolve(false);
    }

    download(dco) {
        return Promise.resolve('plugins/storage.local/plantilla.zip'); // https://workupload.com/start/c2kh9NB'
    }

    share(dco) {
    }

    /*
    Object resources methods
    */
    /*
    List all resouces (files and folder) at an specified path of the object e.g (/, /content)
    returns: Array with the list of objects in the given path. 
    */
    getResources(dco, path) {
        const resources = getCollection('res_'+dco.id, []);
        return Promise.resolve(resources.filter(r => r.path.substr(0, r.path.lastIndexOf('/')+1) == path));
    }
    /*
    Will rename a file in the object directory structure
    returns: { succeed: true | false, message: string };
    */
    renameResource(dco, res, newName) {
        const key = 'res_'+dco.id;
        const resources = getCollection(key, []);
        const newPath = res.path.substr(0, res.path.lastIndexOf('/')+1) + newName;
        if (resources.find(r => r.path == newPath)) return Promise.reject('An item with the same path already exists');
        const item = resources.find(r => r.path == res.path);
        if (!item) Promise.reject('Resource not found');
        item.name = newName;
        const oldPath = item.path + '/';
        item.path = newPath;
        resources.filter(r => r.path.startsWith(oldPath)).map(r => r.path = r.path.replace(oldPath, newPath+'/'));
        updateStoreKey(key, resources);
        return Promise.resolve(item);
    }
    /*
    Will delete a file in the object directory structure
    returns: { succeed: true | false, message: string };
    */
    deleteResource(dco, path) {
        const key = 'res_'+dco.id;
        const resources = getCollection(key, []);
        const basePath = path + '/';
        collections[key] = resources.filter(r => !(r.path == path || r.path.startsWith(basePath)));
        updateStoreKey(key, collections[key]);
        return Promise.resolve(true);
    }
    /*
    Will add a new resource in the directory structure at the given path
    resouce: { type: F|D, name: string, file: Blob | null }
    returns: { succeed: true | false, message: string };
    */
    addResource(dco, res, basepath){
        const key = 'res_'+dco.id;
        const resources = getCollection(key, []);
        const { type, name, size, createdAt, extension } = res;
        if (!/\/$/.test(basepath)) basepath += '/';
        const path = [basepath, name].join('');
        let item = resources.find(r => r.path == path);
        if (item) {
            return Promise.reject('An item with the same path already exists');
        }
        item = {type, path, name, size, createdAt, extension, parent: basepath };
        resources.push(item);
        updateStoreKey(key, resources);
        return Promise.resolve(item);
    }

    /*
    Will get the Index page content for a given dco
    dco: { id: string }
    returns: Promise<base64string>;
    */
    getIndex(dco) {
        const key = 'index_'+dco.id;
        const value = readStoreKey(key, "PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICAgIDxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KICAgIDx0aXRsZT5JbmljaW88L3RpdGxlPgogICAgPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLCBtYXhpbXVtLXNjYWxlPTEsIHVzZXItc2NhbGFibGU9bm8iPgogICAgPGxpbmsgcmVsPSJzaG9ydGN1dCBpY29uIiBocmVmPSJpbWcvaWNvbi5zdmciPgogICAgPGxpbmsgaHJlZj0iY29tcG9uZW50cy9qcXVlcnkvY3NzL2N1c3RvbS9qcXVlcnktdWkubWluLmNzcyIgcmVsPSJzdHlsZXNoZWV0IiB0eXBlPSJ0ZXh0L2NzcyI+CiAgICA8bGluayBocmVmPSJjb21wb25lbnRzL2lvbmljb25zL2Nzcy9pb25pY29ucy5taW4uY3NzIiByZWw9InN0eWxlc2hlZXQiIHR5cGU9InRleHQvY3NzIj4KICAgIDxsaW5rIGhyZWY9ImNzcy9zY29ybXBsYXllci5jc3MiIHJlbD0ic3R5bGVzaGVldCIgdHlwZT0idGV4dC9jc3MiPgoKICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL2pxdWVyeS9qcXVlcnkubWluLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL2pxdWVyeS9qcXVlcnktdWkubWluLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJqcy9hcHAuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImpzL2xhbmcuZXMuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImNvbXBvbmVudHMvc2Nvcm0vcGxheWVyLmpzIj4gPC9zY3JpcHQ+Cgo8L2hlYWQ+Cjxib2R5IGRhdGEtYXV0b2xvYWQ9ImZhbHNlIiBkYXRhLWRpc3BsYXktd2luZG93PSJtb2RhbCIgZGF0YS13aW5kb3ctd2lkdGg9IjEwMCIgZGF0YS13aW5kb3ctaGVpZ2h0PSIxMDAiPgogICAgPGRpdiBpZD0iYm9keSI+CiAgICAgICAgPGhlYWRlcj4KICAgICAgICAgICAgPGgxPk5vbWJyZSBkZWwgPGJyIC8+PHNwYW4+Y29tcG9uZW50ZTwvc3Bhbj4gPHNwYW4gY2xhc3M9ImxldmVsIj5OaXZlbDwvc3Bhbj48L2gxPgogICAgICAgICAgICA8aDI+VMOtdHVsbyBkZSBsYSBhY3RpdmlkYWQ8L2gyPgogICAgICAgICAgICA8aW1nIHNyYz0iaW1nL3BvcnRhZGEucG5nIiB0aXRsZT0iSW5pY2lvIiAvPgogICAgICAgIDwvaGVhZGVyPgoKICAgICAgICA8bWFpbiBpZD0iY29udGVudCI+CiAgICAgICAgICAgIDxkaXY+CiAgICAgICAgICAgICAgICA8cD4KICAgICAgICAgICAgICAgICAgICA8c3Ryb25nPk9iamV0aXZvOjwvc3Ryb25nPgogICAgICAgICAgICAgICAgICAgIGV4cGxvcmFyIGVsIGVzdGlsbyBkZSBhcHJlbmRpemFqZSBwcmVkb21pbmFudGUgZGUgbG9zIHBhcnRpY2lwYW50ZXMsIGNvbiBlbCBmaW4gZGUgYXBvcnRhciBoZXJyYW1pZW50YXMgYWwgcGVuc2FtaWVudG8gY3LDrXRpY28sIHJlZmxleGl2bywgYXJndW1lbnRhdGl2byB5IGNyZWF0aXZvIHBhcmEgZ3VpYXIgbGEgZW5zZcOxYW56YS1hcHJlbmRpemFqZSBlbiBsYXMgw6FyZWFzIGRlIGxhIHNhbHVkLgogICAgICAgICAgICAgICAgPC9wPgoKICAgICAgICAgICAgICAgIDxwPgogICAgICAgICAgICAgICAgICAgIDxzdHJvbmc+TW9kYWxpZGFkOjwvc3Ryb25nPgogICAgICAgICAgICAgICAgICAgIGluZGl2aWR1YWwKICAgICAgICAgICAgICAgIDwvcD4KCiAgICAgICAgICAgICAgICA8cD4KICAgICAgICAgICAgICAgICAgICBFc3RhIGFjdGl2aWRhZCBlc3TDoSBvcmdhbml6YWRhIGVuIHRyZXMgcGFydGVzOgogICAgICAgICAgICAgICAgPC9wPgogICAgICAgICAgICAgICAgPG9sPgogICAgICAgICAgICAgICAgICAgIDxsaT5VbmEgYnJldmUgaW50cm9kdWNjacOzbiByZXNwZWN0byBhIGxvcyBFc3RpbG9zIGRlIGFwcmVuZGl6YWplLjwvbGk+CiAgICAgICAgICAgICAgICAgICAgPGxpPlVuYSBwcnVlYmEgZGVsIEN1ZXN0aW9uYXJpbyBDQU1FQSBwYXJhIHJlY29ub2NlciBsYXMgY2FyYWN0ZXLDrXN0aWNhcyBkZSBzdSBlc3RpbG8gZGUgYXByZW5kaXphamUgaW1wZXJhbnRlIGVuIERlc2N1YnJhIHN1IGVzdGlsbyBkZSBhcHJlbmRpemFqZS48L2xpPgogICAgICAgICAgICAgICAgICAgIDxsaT5VbmEgYWN0aXZpZGFkIGRlIHJlcGFzbyBzb2JyZSBsb3MgZXN0aWxvcyBkZSBhcHJlbmRpemFqZS48L2xpPgogICAgICAgICAgICAgICAgPC9vbD4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDxkaXYgaWQ9ImR1cmF0aW9uIj4KICAgICAgICAgICAgICAgIER1cmFjacOzbjoKICAgICAgICAgICAgICAgIDxzcGFuPjQ8L3NwYW4+CiAgICAgICAgICAgICAgICBob3JhcwogICAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L21haW4+CiAgICAgICAgPGRpdiBpZD0icGxheV9zY29ybSI+PC9kaXY+CiAgICA8L2Rpdj4KPC9ib2R5Pgo8L2h0bWw+Cg==");
        return Promise.resolve(value);
    }

    /*
    Will add a new resource in the directory structure at the given path
    resouce: { type: F|D, name: string, file: Blob | null }
    returns: { succeed: true | false, message: string };
    */
    getContent(dco) {
        const key = 'content_'+dco.id;
        const value = readStoreKey(key, "PCFET0NUWVBFIGh0bWw+CjxodG1sPgo8aGVhZD4KICAgIDxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KICAgIDxsaW5rIHJlbD0ic2hvcnRjdXQgaWNvbiIgaHJlZj0iaW1nL2ljb24uc3ZnIj4KICAgIDxtZXRhIG5hbWU9InZpZXdwb3J0IiBjb250ZW50PSJ3aWR0aD1kZXZpY2Utd2lkdGgsIGluaXRpYWwtc2NhbGU9MSwgbWF4aW11bS1zY2FsZT0xLCB1c2VyLXNjYWxhYmxlPW5vIj4KICAgIDx0aXRsZT5FamVtcGxvIGRlIGVsZW1lbnRvcyBwYXJhIGxvcyBjdXJzb3M8L3RpdGxlPgogICAgPGxpbmsgaHJlZj0iY29tcG9uZW50cy9qcXVlcnkvY3NzL2N1c3RvbS9qcXVlcnktdWkubWluLmNzcyIgcmVsPSJzdHlsZXNoZWV0IiB0eXBlPSJ0ZXh0L2NzcyI+CiAgICA8bGluayBocmVmPSJjb21wb25lbnRzL2lvbmljb25zL2Nzcy9pb25pY29ucy5taW4uY3NzIiByZWw9InN0eWxlc2hlZXQiIHR5cGU9InRleHQvY3NzIj4KICAgIDxsaW5rIGhyZWY9ImNvbXBvbmVudHMvcGl0L2Nzcy9qcGl0X3F1aXouY3NzIiByZWw9InN0eWxlc2hlZXQiIHR5cGU9InRleHQvY3NzIj4KICAgIDxsaW5rIGhyZWY9ImNvbXBvbmVudHMvcGl0L2Nzcy9qcGl0X21hcmsuY3NzIiByZWw9InN0eWxlc2hlZXQiIHR5cGU9InRleHQvY3NzIj4KICAgIDxsaW5rIGhyZWY9ImNvbXBvbmVudHMvcGl0L2Nzcy9qcGl0X3dvcmRwdXp6bGUuY3NzIiByZWw9InN0eWxlc2hlZXQiIHR5cGU9InRleHQvY3NzIj4KICAgIDxsaW5rIGhyZWY9ImNvbXBvbmVudHMvcGl0L2Nzcy9qcGl0X2Nyb3Nzd29yZC5jc3MiIHJlbD0ic3R5bGVzaGVldCIgdHlwZT0idGV4dC9jc3MiPgogICAgPGxpbmsgaHJlZj0iY29tcG9uZW50cy9waXQvY3NzL2pwaXRfem9vbS5jc3MiIHJlbD0ic3R5bGVzaGVldCIgdHlwZT0idGV4dC9jc3MiPgogICAgPGxpbmsgaHJlZj0iY29tcG9uZW50cy9jc3NjaXJjbGUvY2lyY2xlLm1pbi5jc3MiIHJlbD0ic3R5bGVzaGVldCIgdHlwZT0idGV4dC9jc3MiPgoKICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL2pxdWVyeS9qcXVlcnkubWluLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL2pxdWVyeS9qcXVlcnktdWkubWluLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgdHlwZT0idGV4dC9qYXZhc2NyaXB0IiBzcmM9ImNvbXBvbmVudHMvanF1ZXJ5LW1vYmlsZS9qcXVlcnkudWkudG91Y2gtcHVuY2gubWluLmpzIj48L3NjcmlwdD4KCjwhLS1qUXVlcnkgY29tcG9uZW50cyAtLT4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3R3ZW50eXR3ZW50eS9qcy9qcXVlcnkuZXZlbnQubW92ZS5qcyIgdHlwZT0idGV4dC9qYXZhc2NyaXB0Ij48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3R3ZW50eXR3ZW50eS9qcy9qcXVlcnkudHdlbnR5dHdlbnR5LmpzIiB0eXBlPSJ0ZXh0L2phdmFzY3JpcHQiPjwvc2NyaXB0PgogICAgPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSJjb21wb25lbnRzL3R3ZW50eXR3ZW50eS9jc3MvdHdlbnR5dHdlbnR5LmNzcyIgdHlwZT0idGV4dC9jc3MiIG1lZGlhPSJzY3JlZW4iIC8+CgogICAgPHNjcmlwdCBzcmM9ImNvbXBvbmVudHMvbWVkaWFlbGVtZW50anMvbWVkaWFlbGVtZW50LWFuZC1wbGF5ZXIubWluLmpzIiB0eXBlPSJ0ZXh0L2phdmFzY3JpcHQiPjwvc2NyaXB0PgogICAgPGxpbmsgcmVsPSJzdHlsZXNoZWV0IiBocmVmPSJjb21wb25lbnRzL21lZGlhZWxlbWVudGpzL21lZGlhZWxlbWVudHBsYXllci5jc3MiIHR5cGU9InRleHQvY3NzIiAvPgoKICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL21hcGhpbGlnaHQvanF1ZXJ5Lm1hcGhpbGlnaHQubWluLmpzIiB0eXBlPSJ0ZXh0L2phdmFzY3JpcHQiPjwvc2NyaXB0Pgo8IS0tRW5kIGpRdWVyeSBjb21wb25lbnRzIC0tPgoKICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL2ludGVyYWN0L2ludGVyYWN0Lm1pbi5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvanBpdF9hcGkuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImNvbXBvbmVudHMvcGl0L3V0aWxpdGllcy9qcGl0X3V0aWxpdGllcy5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvYWN0aXZpdHkvanBpdF9hY3Rpdml0eS5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvcmVzb3VyY2VzL2pwaXRfcmVzb3VyY2UuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImNvbXBvbmVudHMvcGl0L2FjdGl2aXR5L3F1aXovanBpdF9hY3Rpdml0eV9xdWl6LmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3BpdC9hY3Rpdml0eS9tYXJrL2pwaXRfYWN0aXZpdHlfbWFyay5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvYWN0aXZpdHkvd29yZHB1enpsZS9qcGl0X2FjdGl2aXR5X3dvcmRwdXp6bGUuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImNvbXBvbmVudHMvcGl0L2FjdGl2aXR5L2Ryb3BwYWJsZS9qcGl0X2FjdGl2aXR5X2Ryb3BwYWJsZS5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvYWN0aXZpdHkvY3Jvc3N3b3JkL2pwaXRfYWN0aXZpdHlfY3Jvc3N3b3JkLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3BpdC9hY3Rpdml0eS9jbG96ZS9qcGl0X2FjdGl2aXR5X2Nsb3plLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3BpdC9hY3Rpdml0eS9mb3JtL2pwaXRfYWN0aXZpdHlfZm9ybS5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvYWN0aXZpdHkvc29ydGFibGUvanBpdF9hY3Rpdml0eV9zb3J0YWJsZS5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvYWN0aXZpdHkvY2hlY2svanBpdF9hY3Rpdml0eV9jaGVjay5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0iY29tcG9uZW50cy9waXQvcmVzb3VyY2VzL21vdmkvanBpdF9yZXNvdXJjZV9tb3ZpLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3BpdC9yZXNvdXJjZXMvem9vbS9qcGl0X3Jlc291cmNlX3pvb20uanMiPjwvc2NyaXB0PgoKICAgIDxzY3JpcHQgc3JjPSJqcy9hcHAuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImpzL2luaXQuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImpzL2xhbmcuZXMuanMiPjwvc2NyaXB0PgogICAgPHNjcmlwdCBzcmM9ImpzL2xpYi5qcyI+PC9zY3JpcHQ+CiAgICA8c2NyaXB0IHNyYz0ianMvbW9iaWxlbGliLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJqcy9zdG9yaWVzLmpzIj48L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3Njb3JtL1NDT1JNXzEyX0FQSVdyYXBwZXIuanMiPiA8L3NjcmlwdD4KICAgIDxzY3JpcHQgc3JjPSJjb21wb25lbnRzL3Njb3JtL3Njb3JtX2FwaS5qcyI+IDwvc2NyaXB0PgoKICAgIDxzdHlsZSB0eXBlPSd0ZXh0L2Nzcyc+CgogICAgICAgIGJvZHkgewogICAgICAgICAgICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2JhKDI0MiwgMjQyLCAyNDIsIDAuNyk7CiAgICAgICAgfQoKICAgICAgICBib2R5LmxvYWRpbmcgewogICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7CiAgICAgICAgfQoKICAgICAgICBib2R5LmxvYWRpbmc6YWZ0ZXIgewogICAgICAgICAgICBjb250ZW50OiAiIjsKICAgICAgICAgICAgYmFja2dyb3VuZDogdXJsKGltZy9sb2FkaW5nLmdpZikgbm8tcmVwZWF0IGJvdHRvbSBjZW50ZXI7CiAgICAgICAgICAgIHdpZHRoOiAxMzBweDsKICAgICAgICAgICAgaGVpZ2h0OiAzMHB4OwogICAgICAgICAgICBkaXNwbGF5OiBibG9jazsKICAgICAgICAgICAgbWFyZ2luOiBhdXRvOwogICAgICAgICAgICBwYWRkaW5nLWJvdHRvbTogMjBweDsKICAgICAgICB9CgogICAgICAgIGJvZHkubG9hZGluZyAjYm9keSB7CiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7CiAgICAgICAgfQogICAgPC9zdHlsZT4KCjwvaGVhZD4KPGJvZHkgY2xhc3M9ImxvYWRpbmciIGRhdGEtZGVidWc9InRydWUiIGRhdGEtZGlzcGxheS1tb2RlPSJzbGlkZXMiIGRhdGEtYXBwcm92ZS1saW1pdD0iNzAiIGRhdGEtYWN0aXZpdGllcy1wZXJjZW50YWplPSI2MCIgZGF0YS1tb2JpbGUtbW9kZT0iNTEyIj4KICAgIDxkaXYgaWQ9InRvcC1kZWNvcmF0aW9uIiBjbGFzcz0ibm90X3ByaW50Ij48L2Rpdj4KCiAgICA8ZGl2IGlkPSJib2R5IiBjbGFzcz0ibm90X3ByaW50Ij4KICAgICAgICA8ZGl2IGlkPSJub3Rfc2Nvcm1fbXNnIiBzdHlsZT0iZGlzcGxheTogbm9uZTsiPjwvZGl2PgoKICAgICAgICA8bmF2IGxhYmVsPSJDYXJhY3RlcsOtc3RpY2FzIGdsb2JhbGVzIiBjbGFzcz0iZ2xvYmFscyI+CiAgICAgICAgICAgIDxtZW51PgogICAgICAgICAgICAgICAgPG1lbnVpdGVtIGRhdGEtZ2xvYmFsLWlkPSJyZXR1cm4iPgogICAgICAgICAgICAgICAgICAgIDxpIHRpdGxlPSJNYXhpbWl6YXIiIGNsYXNzPSJpb24tYXJyb3ctZXhwYW5kIHRvb2x0aXAgbWF4aW1pemUiIGRhdGEtcG9zaXRpb24tYXQ9InRvcCI+PC9pPgogICAgICAgICAgICAgICAgICAgIDxpIHRpdGxlPSJNaW5pbWl6YXIiIGNsYXNzPSJpb24tYXJyb3ctc2hyaW5rIHRvb2x0aXAgbWluaW1pemUiIGRhdGEtcG9zaXRpb24tYXQ9InRvcCI+PC9pPgogICAgICAgICAgICAgICAgPC9tZW51aXRlbT4KICAgICAgICAgICAgICAgIDxtZW51aXRlbSBkYXRhLWdsb2JhbC1pZD0iY2xvc2VfYWxsIj48aSB0aXRsZT0iUmVncmVzYXIiIGNsYXNzPSJpb24tY2xvc2UtY2lyY2xlZCB0b29sdGlwIiBkYXRhLXBvc2l0aW9uLWF0PSJ0b3AiPjwvaT48L21lbnVpdGVtPgogICAgICAgICAgICA8L21lbnU+CiAgICAgICAgPC9uYXY+CgogICAgICAgIDxoZWFkZXI+CiAgICAgICAgICAgIDxoMj5QbGFudGlsbGEgZGUgcHJvZHVjY2nDs24gZGUgY29udGVuaWRvcyBpbnRlcmFjdGl2b3M8L2gyPgogICAgICAgICAgICA8bmF2IGxhYmVsPSJQcmluY2lwYWwiIGNsYXNzPSJob3Jpem9udGFsIG1haW4iIGRhdGEtb2Zmc2V0PSJ0cnVlIj4KICAgICAgICAgICAgICAgIDxtZW51PgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iUHJlc2VudGFjacOzbiIgZGF0YS1wYWdlPSJwYWctaW5pY2lvIj48L21lbnVpdGVtPgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iQ29tcG9uZW50ZXMiPgogICAgICAgICAgICAgICAgICAgICAgICA8bWVudT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iMS4gVGV4dG9zIGVzcGVjaWFsZXMiIGRhdGEtcGFnZT0icGFnLXRleHRvcyI+PC9tZW51aXRlbT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iMi4gTXVsdGltZWRpYSIgZGF0YS1wYWdlPSJwYWctbWVkaWEiPjwvbWVudWl0ZW0+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8bWVudWl0ZW0gbGFiZWw9IjMuIEZvcm1hdG8gZGUgY29udGVuaWRvIiBkYXRhLXBhZ2U9InBhZy1jb250ZW5pZG9pbnRlcmFjdGl2byI+PC9tZW51aXRlbT4KICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iNC4gQWN0aXZpZGFkZXMiIGRhdGEtcGFnZT0icGFnLWFjdGl2aWRhZGVzIj48L21lbnVpdGVtPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgPG1lbnVpdGVtIGxhYmVsPSI1LiBSZWZlcmVuY2lhcyIgZGF0YS1wYWdlPSJwYWctcmVmZXJlbmNpYXMiPjwvbWVudWl0ZW0+CiAgICAgICAgICAgICAgICAgICAgICAgIDwvbWVudT4KICAgICAgICAgICAgICAgICAgICA8L21lbnVpdGVtPgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBsYWJlbD0iTWFxdWV0YWNpw7NuIiBkYXRhLXBhZ2U9InBhZy1tYXF1ZXRhY2lvbiI+PC9tZW51aXRlbT4KICAgICAgICAgICAgICAgIDwvbWVudT4KICAgICAgICAgICAgPC9uYXY+CiAgICAgICAgPC9oZWFkZXI+CgogICAgICAgIDxtYWluIHN0eWxlPSJkaXNwbGF5OiBub25lOyI+PHNlY3Rpb24gaWQ9InBhZ2VfMSIgZGF0YS1jbXB0LXR5cGU9InBhZ2UiIHB0aXRsZT0iUMOhZ2luYSB1bm8iPjxkaXYgaWQ9InNlY3Rpb25fMSIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDEiPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fMyIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDMiPjwvZGl2Pjwvc2VjdGlvbj48c2VjdGlvbiBpZD0icGFnZV8yIiBkYXRhLWNtcHQtdHlwZT0icGFnZSIgcHRpdGxlPSJQw6FnaW5hIGRvcyI+PGRpdiBpZD0ic2VjdGlvbl80IiBkYXRhLWNtcHQtdHlwZT0ic2VjdGlvbiIgZGF0YS10aXRsZT0iU2VjY2nDs24gY3VhdHJvIj48L2Rpdj48ZGl2IGlkPSJzZWN0aW9uXzIiIGRhdGEtY21wdC10eXBlPSJzZWN0aW9uIiBkYXRhLXRpdGxlPSJTZWNjacOzbiBkb3MgcXVlIGVzIG11eSBsYXJnbyBlbCB0aXR1bG8iPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fNSIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDUiPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fNiIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDYiPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fNyIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDciPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fOCIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDgiPjwvZGl2PjxkaXYgaWQ9InNlY3Rpb25fOSIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDkiPjwvZGl2Pjwvc2VjdGlvbj48c2VjdGlvbiBpZD0icGFnZV8zIiBkYXRhLWNtcHQtdHlwZT0icGFnZSIgcHRpdGxlPSJQw6FnaW5hIDMiPjxkaXYgaWQ9InNlY3Rpb25fMTAiIGRhdGEtY21wdC10eXBlPSJzZWN0aW9uIiBkYXRhLXRpdGxlPSJTZWNjacOzbiAxMCI+PC9kaXY+PGRpdiBpZD0ic2VjdGlvbl8xMSIgZGF0YS1jbXB0LXR5cGU9InNlY3Rpb24iIGRhdGEtdGl0bGU9IlNlY2Npw7NuIDExIj48L2Rpdj48ZGl2IGlkPSJzZWN0aW9uXzEyIiBkYXRhLWNtcHQtdHlwZT0ic2VjdGlvbiIgZGF0YS10aXRsZT0iU2VjY2nDs24gMTIiPjwvZGl2Pjwvc2VjdGlvbj48L21haW4+CgogICAgICAgIDxmb290ZXIgY2xhc3M9Im5vdF9wcmludCI+CiAgICAgICAgICAgIDxzcGFuIGlkPSJsYWJlbG1lYXN1cmluZ3Byb2dyZXNzIj5BdmFuY2U8L3NwYW4+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Im1lYXN1cmluZy1wcm9ncmVzcyIgZGF0YS10eXBlPSJjaXJjbGUiPjwvZGl2PgoKICAgICAgICAgICAgPG5hdiBsYWJlbD0iR2VuZXJhbCIgY2xhc3M9Imdsb2JhbHMyIj4KICAgICAgICAgICAgICAgIDxtZW51PgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBkYXRhLWdsb2JhbC1pZD0icmVzdWx0cyI+PHNwYW4+PGkgY2xhc3M9Imlvbi1zcGVlZG9tZXRlciIgZGF0YS1wb3NpdGlvbi1hdD0icmlnaHQgdG9wIj48L2k+IDxiciAvPjxsYWJlbCBpZD0ibGFiZWxwcm9ncmVzcyI+UHJvZ3Jlc288L2xhYmVsPjwvc3Bhbj48L21lbnVpdGVtPgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBkYXRhLWdsb2JhbC1pZD0iY3JlZGl0cyI+PHNwYW4+PGkgY2xhc3M9Imlvbi1pbmZvcm1hdGlvbi1jaXJjbGVkIiBkYXRhLXBvc2l0aW9uLWF0PSJyaWdodCB0b3AiPjwvaT4gPGJyIC8+PGxhYmVsIGlkPSJsYWJlbHByb2dyZXNzIj5DcsOpZGl0b3M8L2xhYmVsPjwvc3Bhbj48L21lbnVpdGVtPgogICAgICAgICAgICAgICAgICAgIDxtZW51aXRlbSBkYXRhLWdsb2JhbC1pZD0ibGlicmFyeSI+PHNwYW4+PGkgY2xhc3M9Imlvbi1pb3MtYm9vayIgZGF0YS1wb3NpdGlvbi1hdD0icmlnaHQgdG9wIj48L2k+IDxiciAvPjxsYWJlbCBpZD0ibGFiZWxwcm9ncmVzcyI+QmlibGlvZ3JhZsOtYTwvbGFiZWw+PC9zcGFuPjwvbWVudWl0ZW0+CiAgICAgICAgICAgICAgICA8L21lbnU+CiAgICAgICAgICAgIDwvbmF2PgoKICAgICAgICAgICAgPGRpdiBpZD0ic3VicGFnZXNfbWVudSI+CiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJidXR0b24iIHByZXZpb3VzLXBhZ2U+PC9kaXY+CiAgICAgICAgICAgICAgICA8dWwgY2xhc3M9ImJ1dHRvbiIgc3VicGFnZXMtbWVudT48L3VsPgogICAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iYnV0dG9uIiBuZXh0LXBhZ2U+PC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgPGRpdiBpZD0icGFnZV9udW1iZXIiPjwvZGl2PgogICAgICAgIDwvZm9vdGVyPgoKICAgIDwvZGl2PgoKICAgIDxkaXYgaWQ9InJlc3VsdHNfcGFnZSIgc3R5bGU9ImRpc3BsYXk6bm9uZTsiPgogICAgICAgIDxoMj5SZXN1bWVuIGRlIHN1IGF2YW5jZSBlbiBsYSBsZWN0dXJhIGRlbCBkb2N1bWVudG88L2gyPgogICAgICAgIDxoMz5Qw6FnaW5hcyB2aXNpdGFkYXM8L2gzPgogICAgICAgIDxwPkVuIHZlcmRlLCBhcXVlbGxhcyBww6FnaW5hcyBxdWUgeWEgaGEgdmlzaXRhZG8uPC9wPgogICAgICAgIDxkaXYgaWQ9InJlc3VsdHNfcGFnZV92aXNpdGVkIiBjbGFzcz0iY29udGFpbmVyIj48L2Rpdj4KICAgICAgICA8YnIgY2xhc3M9ImNsZWFyIiAvPgogICAgICAgIDxoMz5BY3RpdmlkYWRlcyBkZSBhcHJlbmRpemFqZTwvaDM+CiAgICAgICAgPGRpdiBpZD0icmVzdWx0c19wYWdlX2FjdGl2aXRpZXMiPjwvZGl2PgogICAgPC9kaXY+CgogICAgPGRpdiBpZD0icHJpbnRlbnRfY29udGVudCIgc3R5bGU9ImRpc3BsYXk6bm9uZTsiPgogICAgICAgIDxkaXYgY2xhc3M9ImNvbnRlbnQiPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9ImJ1dHRvbl9jb250YWluZXIiPgogICAgICAgICAgICA8YnV0dG9uIGNsYXNzPSJnZW5lcmFsIGJ1dHRvbiIgb25jbGljaz0id2luZG93LnByaW50KCk7Ij5JbXByaW1pcjwvYnV0dG9uPgogICAgICAgICAgICA8YnV0dG9uIGlkPSJwcmludGVudF9iYWNrIiBjbGFzcz0iZ2VuZXJhbCBidXR0b24iID5Wb2x2ZXI8L2J1dHRvbj4KICAgICAgICA8L2Rpdj4KICAgIDwvZGl2PgoKICAgIDwhLS10ZXB1eTppbmRlcGVuZGVudC1zZWN0aW9ucy0tPgogICAgPCEtLUNyw6lkaXRvcy0tPgogICAgPGRpdiBpZD0iY3JlZGl0cy1wYWdlIiBzdHlsZT0iZGlzcGxheTpub25lOyI+CiAgICAgICAgPGRpdiBpZD0iY3JlZGl0c19zdWJwYWdlIj4KICAgICAgICAgICAgPGgyPkNyw6lkaXRvczwvaDI+CgogICAgICAgICAgICA8cD4KICAgICAgICAgICAgICAgIEVzdGEgcGxhbnRpbGxhIGhhIHNpZG8gY3JlYWRhIGNvbiBlbCBhcG9ydGUgZGUgdmFyaWFzIHBlcnNvbmFzIGUgaW5zdGl0dWNpb25lcywgcHJpbmNpcGFsbWVudGUgbGFzIHF1ZSBzZSBkZWZpbmVuIG3DoXMgYWJham8uIE5vIG9ic3RhbnRlLCB1dGlsaXphIHZhcmlhcyBsaWJlcsOtYXMgT3BlblNvdXJjZSB5IHN1cyBmdWVudGVzIHNvbiBsaWJlcmFkYXMgYmFqbyBsYSBsaWNlbmNpYSBHTlUvR1BMIHYzLCBsYSBjdWFsIGRlYmUgZXN0YXIgYWRqdW50YSBhIGVzdGUgcGFxdWV0ZS4gQ2FkYSBsaWJyZXLDrWEgZXh0ZXJuYSB1dGlsaXphZGEgZW4gZXN0ZSBwcm95ZWN0byBwb3NlZSB1bmFzIGxpY2VuY2lhcyB5IGF1dG9yw61hcyBwYXJ0aWN1bGFyZXMgcXVlIGRlYmVuIHNlciByZXNwZXRhZGFzLiBBIHN1IHZleiwgbGEgZG9jdW1lbnRhY2nDs24gcG9zZWUgdW5hIGxpY2VuY2lhIENyZWF0aXZlIENvbW1vbnMgY29tbyBzZSBkZW5vdGEgYWwgcGllIGRlIGVzdGEgcMOhZ2luYS4KICAgICAgICAgICAgPC9wPgogICAgICAgICAgICA8ZGl2PgogICAgICAgICAgICAgICAgPGgzPkV4cGVydG9zIHRlbcOhdGljb3M8L2gzPgogICAgICAgICAgICAgICAgPGNpdGU+RGF2aWQgSGVybmV5IEJlcm5hbCBHYXJjw61hPGJyIC8+CiAgICAgICAgICAgICAgICBMZWlkeSBDcmlzdGluYSBNYWRyaWdhbCBBcnJpZXRhPC9jaXRlPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICAgIDxoMz5Bc2Vzb3LDrWEgcGVkYWfDs2dpY2E8L2gzPgogICAgICAgICAgICAgICAgPGNpdGU+RGF2aWQgSGVybmV5IEJlcm5hbCBHYXJjw61hPC9jaXRlPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICAgIDxoMz5Db3JyZWNjacOzbiBkZSBlc3RpbG88L2gzPgogICAgICAgICAgICAgICAgPGNpdGU+RGF2aWQgSGVybmV5IEJlcm5hbCBHYXJjw61hPC9jaXRlPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICAgIDxoMz5UcmFkdWNjacOzbiBkZSBjb250ZW5pZG9zPC9oMz4KICAgICAgICAgICAgICAgIDxjaXRlPkRhdmlkIEhlcm5leSBCZXJuYWwgR2FyY8OtYTwvY2l0ZT4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDxkaXY+CiAgICAgICAgICAgICAgICA8aDM+R2VzdGnDs24gQWRtaW5pc3RyYXRpdmE8L2gzPgogICAgICAgICAgICAgICAgPGNpdGU+RGF2aWQgSGVybmV5IEJlcm5hbCBHYXJjw61hPC9jaXRlPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICAgIDxoMz5EaXNlw7FvIGdyw6FmaWNvPC9oMz4KICAgICAgICAgICAgICAgIDxjaXRlPkVsaXphYmV0aCBIZXJuYW5kZXogR29uemFsZXo8L2NpdGU+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8ZGl2PgogICAgICAgICAgICAgICAgPGgzPkludGVncmFjacOzbiBkZSBjb250ZW5pZG9zPC9oMz4KICAgICAgICAgICAgICAgIDxjaXRlPkRhdmlkIEhlcm5leSBCZXJuYWwgR2FyY8OtYTwvY2l0ZT4KICAgICAgICAgICAgPC9kaXY+CgogICAgICAgICAgICA8ZGl2PgogICAgICAgICAgICAgICAgPGgzPlByb2R1Y2Npw7NuPC9oMz4KICAgICAgICAgICAgICAgIDxwIGNsYXNzPSJsb2dvcyI+CiAgICAgICAgICAgICAgICAgICAgPGEgaHJlZj0iaHR0cDovL3d3dy51ZGVhLmVkdS5jby8iIHRhcmdldD0iX2JsYW5rIj48aW1nIHNyYz0iY29udGVudC9sb2dvX3VkZWEucG5nIiBhbHQ9IlVkZUEiIC8+PC9hPgogICAgICAgICAgICAgICAgICAgIDxiciAvPgogICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9Imh0dHA6Ly93d3cudWRlbS5lZHUuY28iIHRhcmdldD0iX2JsYW5rIj48aW1nIHNyYz0iY29udGVudC9sb2dvX3VkZW0ucG5nIiBhbHQ9IlVkZU0iIC8+PC9hPgogICAgICAgICAgICAgICAgICAgIDxiciAvPgogICAgICAgICAgICAgICAgICAgIDxhIGhyZWY9Imh0dHBzOi8vYmFtYnVjby5jby8iIHRhcmdldD0iX2JsYW5rIj48aW1nIHNyYz0iY29udGVudC9sb2dvX2JhbWJ1Y28ucG5nIiBhbHQ9IkJhbWJ1Q29sZWN0aXZvIiAvPjwvYT4KICAgICAgICAgICAgICAgIDwvcD4KICAgICAgICAgICAgPC9kaXY+CgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJlZGl0aW9ucyI+CiAgICAgICAgICAgICAgICAxwqogZWRpY2nDs246IGRpY2llbWJyZSAyMDEzPGJyIC8+CiAgICAgICAgICAgICAgICAywqogZWRpY2nDs246IG9jdHVicmUgMjAxNTxiciAvPgogICAgICAgICAgICAgICAgM8KqIGVkaWNpw7NuOiBmZWJyZXJvIDIwMTY8YnIgLz4KICAgICAgICAgICAgICAgIDTCqiBlZGljacOzbjoganVuaW8gMjAxNwogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdj4KICAgICAgICAgICAgICAgIDxiciAvPgogICAgICAgICAgICAgICAgPGEgaHJlZj0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbGljZW5zZXMvYnktc2EvNC4wLyIgdGFyZ2V0PSJfYmxhbmsiPkNvbnRlbmlkbyBwdWJsaWNhZG8gYmFqbyBsaWNlbmNpYTo8YnIgLz5DcmVhdGl2ZSBDb21tb25zIEF0cmlidWNpw7NuLUNvbXBhcnRpciBJZ3VhbCA0LjAgSW50ZXJuYWNpb25hbDxiciAvPjxiciAvPgogICAgICAgICAgICAgICAgPGltZyBzcmM9ImltZy9jYy5wbmciIGFsdD0iQ3JlYXRpdmUgQ29tbW9ucyIgLz48L2E+PGJyIC8+CiAgICAgICAgICAgICAgICBFbCBzb2Z0d2FyZSBlc3TDoSByZWdpZG8gcG9yIGxpY2VuY2lhcyBlc3BlY8OtZmljYXMsIHNpZW5kbyBsYSBwb3IgZGVmZWN0byBHTlUvR1BMIHYzIChzZSBpbmNsdXllIHVuYSBjb3BpYSkuCiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgPHA+CiAgICAgICAgICAgICAgICBFc3RlIHByb3llY3RvIHByZXRlbmRlIHNlciDDunRpbCBlbiBhbWJpZW50ZXMgZWR1Y2F0aXZvcywgcGVybyBwb3Igc3UgbmF0dXJhbGV6YSB0YW1iacOpbiBzZXLDoSB1dGlsaXphZG8gZW4gYW1iaWVudGVzIGNvbWVyY2lhbGVzLiBTaSBjb25zaWRlcmEgcXVlIHNlIGluY2x1eWUgYWxnbyBkZSBzdSBwcm9waWVkYWQgbyBkZSBsYSBpbnN0aXR1Y2nDs24gcXVlIHJlcHJlc2VudGEgeSBxdWUgbm8gZGVzZWEgcXVlIHNlYSB1dGlsaXphZG8sIHBvciBmYXZvciBpbmRpY2FybG8gZW4gbGEgcMOhZ2luYSBkZWwgcHJveWVjdG8gbyBhbCBjb3JyZW8gPGEgaHJlZj0ibWFpbHRvOmRhdmlkLmJlcm5hbEBiYW1idWNvLmNvIj5kYXZpZC5iZXJuYWxAYmFtYnVjby5jbzwvYT4gcGFyYSBxdWUgc2UgYW5hbGljZSB5LCBlbiBjYXNvIGRlIHF1ZSBzZSByZXF1aWVyYSwgc2VhIHJldGlyYWRvLgogICAgICAgICAgICA8L3A+CiAgICAgICAgICAgIDxwPgogICAgICAgICAgICAgICAgTG9zIGxvZ29zIHkvbyBub21icmVzIHByZXNlbnRlcyBlbiBlc3RvcyBjcsOpZGl0b3Mgbm8gcHVlZGVuIHNlciB1dGlsaXphZG9zIHBhcmEgaW5kaWNhciBhdXRvcsOtYSBkZSBjb250ZW5pZG9zIHBvciBmdWVyYSBkZSBsb3Mgb3JpZ2luYWxlcyB5IG5vIHNlIGF0cmlidXllIG5pbmd1bmEgcmVzcG9uc2FiaWxpZGFkIHBvciBzdSB1dGlsaXphY2nDs24gZnVlcmEgZGUgbG9zIGFncmFkZWNpbWllbnRvcyBxdWUgc2Ugb3RvcmdhbiBlbiBlc3RhIHBsYW50aWxsYS4gQXPDrSBtaXNtbywgbG9zIGRlc2Fycm9sbGFkb3JlcyBlIGluc3RpdHVjaW9uZXMgaW52b2x1Y3JhZGFzIGVudHJlZ2FuIGVzdGEgaGVycmFtaWVudGEgImNvbW8gZXMiIHkgbm8gc2UgaGFjZW4gcmVzcG9uc2FibGVzIHBvciBsbyBxdWUgc2UgaGFnYSBjb24gZWxsYSBuaSBwb3IgZXJyb3JlcywgZmFsbGFzIHUgb3Ryb3MgcGVyanVpY2lvcyBkZXJpdmFkb3MgZGUgc3UgdXRpbGl6YWNpw7NuLgogICAgICAgICAgICA8L3A+CiAgICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8IS0tIEJpYmxpb2dyYWbDrWEgLS0+CiAgICA8ZGl2IGlkPSJsaWJyYXJ5LXBhZ2UiIHN0eWxlPSJkaXNwbGF5Om5vbmU7Ij4KICAgICAgICA8ZGl2IGlkPSJsaWJyYXJ5X3N1YnBhZ2UiPgogICAgICAgICAgICA8aDI+UmVmZXJlbmNpYXMgYmlibGlvZ3LDoWZpY2FzPC9oMj4KCiAgICAgICAgICAgIDx1bCBjbGFzcz0iZGF0YV9saXN0Ij4KICAgICAgICAgICAgICAgIDxsaT48L2xpPgogICAgICAgICAgICA8L3VsPgogICAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgICA8IS0tZW5kdGVwdXktLT4KPC9ib2R5Pgo8L2h0bWw+");
        return Promise.resolve(value);
    }

    updateIndex(dco, index) {
        const key = 'index_'+dco.id;
        updateStoreKey(key, index);
    }

    updateContent(dco, content) {
        const key = 'content_'+dco.id;
        updateStoreKey(key, content);
    }
}
