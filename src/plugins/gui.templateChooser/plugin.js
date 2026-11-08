import { App } from '../../js/app';

export class GuiTemplateChooser {

    constructor() {
        App.registerHook('gui_view_home', this.initialize.bind(this));

        //Guarantee this context on handlers
        this.createObject = this.createObject.bind(this);
        this.closeDetail = this.closeDetail.bind(this);
        this.openForEdition = this.openForEdition.bind(this);
        this.delete = this.delete.bind(this);
    }

    initialize(params) {
        //Set the after templates load handler.
        this.initParams = params||{};
        if (this.initParams.afterTemplatesLoadOnce) {
            this.afterTemplatesLoadOnce = this.initParams.afterTemplatesLoadOnce;
        }
        const sidebarTpl = $.templates("script#gui-tplchooser-sidebar");
        const contentTpl = $.templates("script#gui-tplchooser-content");

        this.onTabActivate = (event, ui) => {
            this.activateTab(ui.newTab, ui.oldTab);
        }
        this.loadNewTab();
        contentTpl.link(App.ui.$content, this);
        sidebarTpl.link(App.ui.$sidebar, this);
        App.$container.localize();
    }

    activateTab(tab, oldTab) {
        let id = tab.data().tabId;
        switch(id) {
            case 'tab_new':
                this.loadNewTab();
                break;
            case 'tab_edit':
                this.loadEditTab();
                break;
        }
    }

    loadNewTab() {
        this.model = {
            templates: [],
            activeTemplate: {},
            categories: []
        };
        setTimeout(() => App.ui.$content.localize(), 100);
        $.observable(this).setProperty('template', '#gui-tplchooser-new-content');
        //Load categories
        App.storage.getTemplateCategories().then(categories => {
            $.observable(this.model.categories).refresh(categories);
        });
        //Load templates
        App.storage.getTemplates({}).then(templates => {
            $.observable(this.model.templates).refresh(templates);
            if (this.afterTemplatesLoadOnce) {
                this.afterTemplatesLoadOnce.apply(null, [this, templates]);
                delete this.afterTemplatesLoadOnce;
            }
        });
    }

    loadEditTab() {
        this.model = {
            objects: [],
            activeObject: {}
        };
        setTimeout(() => App.ui.$content.localize(), 100);
        $.observable(this).setProperty('template', '#gui-tplchooser-edit-content');
        //Load Objects
        App.storage.getObjects({}).then(objects => {
            $.observable(this.model.objects).refresh(objects);
        });
    }

    ownedByMe(obj) {
        return App.data.user && obj.createdBy == App.data.user.userName;
    }

    applyFilter(e) {
        e.preventDefault();
        if (this.isBusy) return;
        const $keyword = App.ui.$sidebar.find('#keyword');
        const $categories = App.ui.$sidebar.find("#categories input[type=checkbox]:checked");
        const cats = $categories.map((i, cat) => cat.value);
        this.isBusy = true;
        App.storage.getTemplates({keyword: $keyword.val(), categories: cats.get()}).then(templates => {
            $.observable(this.model.templates).refresh(templates);
        })
        .finally(() => this.isBusy = false);
    }

    applyObjectsFilter(e) {
        e && e.preventDefault();
        var objects = App.storage.getObjects({});
        $.observable(this.model.objects).refresh(objects);
        this.isBusy = true;
        App.storage.getObjects({}).then(objects => {
            $.observable(this.model.objects).refresh(objects);
        })
        .finally(() => this.isBusy = false);
    }

    showDetail(e) {
        let $target = $(e.currentTarget);
        let id = $target.data().id;
        let template = this.model.templates.find(it => it.id == id);
        $.observable(this.model).setProperty('activeTemplate', template);
        App.ui.$content.localize();

        let $tpl = $target.data('templateDetail');

        if (!$tpl) {
            $tpl = $("#templateDetail").clone(true);
            $target.data('templateDetail', $tpl);
        }

        this.modal = new App.ui.components.Dialog({
            host: $tpl,
            width: '60%',
            centerOnContent: true,
            title: template.name
        });
        this.modal.setButtons([]);
        this.modal.showModal();
    }

    closeDetail(destroy) {
        if (!this.modal) return;
        this.modal.close(destroy);
    }

    createObjectFromTemplate(template) {
        if (template == null) {
            throw TypeError('template is not defined');
        }
        const exist = this.model.templates.find(it => it.id == template.id);

        if (!exist) {
            throw 'Unable to find template with id ' + template.id;
        }

        $.observable(this.model).setProperty('activeTemplate', exist);
        App.ui.$content.localize();

        this.createObject();
    }

    createObject(e, args) {
        this.closeDetail(true);
        App.storage.getSpecList().then(specs => {
            this.showNewObjectForm(specs.map(spec => ({ value: spec.id, label: spec.name, description: spec.description })));
        })
        .catch(err => {
            App.ui.components.Dialog.message(App.i18n.t('dco.errors.getspeclist'), App.i18n.t('tepuy'));
            console.log(err);
        })

    }

    showNewObjectForm(types) {
        const builder = App.ui.components.FormBuilder;
        const validators = App.validation.validators;

        let defaultType = types.length > 0 ? types[0].value : '';

        let typesInfo = '<ul>';
        types.forEach(type => { typesInfo += '<li><strong>' + type.label + ':</strong>' + type.description + '</li>'; });
        typesInfo += '</ul>';

        let formConfig = builder.group({
            name: ['text', '', { label: 'dco.name', validators: [ validators.required ]}],
            type: ['radio', defaultType, { label: 'dco.type', validators: [ validators.required ], options: types, info: typesInfo }],
            shareWith: ['shareList', [], { label: 'dco.shareList', validators: [] }]
        });
        const titleText = 'dco.newTitle';
        let manager = new App.ui.components.FormManager({formConfig, titleText});
        manager.openDialog({ width: '60vw' }).then(this.createNewObject.bind(this)).catch((err) => {
            console.log(err);
        });
    }

    createNewObject(properties) {
        App.DcoManager.createNew(this.model.activeTemplate, properties, App.storage).then(dco => {
            App.data.dco = new App.DcoManager(dco, App.storage);
            App.ui.load('editor', null);
        }).catch(err => {
            console.log(err); //ToDo: Error handling
        });
    }

    openForEdition(dco) {
        App.data.dco = new App.DcoManager(dco, App.storage);
        App.ui.load('editor', null);
    }

    delete(dco) {
        const text = 'dco.deleteConfirmation';
        const question = App.i18n.t(text, {  }, {interpolation: {escapeValue: false}});
        const title = App.i18n.t('dco.deleteTitle');

        App.ui.components.Dialog.confirm(question, title).then(result => {
            if (!result) return;
            App.storage.delete(dco).then(() => {
                this.applyObjectsFilter();
            });
        });
    }
}
