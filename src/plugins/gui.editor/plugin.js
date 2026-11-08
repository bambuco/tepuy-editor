import moment from 'moment';

import { App } from '../../js/app';
import { TemplateManager } from './templateManager';
import { ContentTreeManager } from './contentTreeManager';
//import { ResourceTreeManager } from './resourceTreeManager';
import { ResourceTreeManager } from '../../js/resourceTreeManager';
import { ComponentEditor } from './componentEditor';
import { MetadataEditor } from './metadataEditor';
import { StylesheetEditor } from './stylesheetEditor';
import { downloadFile, filenamify } from '../../js/utils';

const templateMap = {
    sidebar: 'script#gui-editor-sidebar',
    content: 'script#gui-editor-content',
    editPage: 'script#gui-editor-edit-page'
}

const CONTENT_TAB ='tab-1';
const LOOK_TAB ='tab-2';
const RESOURCES_TAB ='tab-3';
const LOG_TAB ='tab-4';
const SHARE_TAB ='tab-5';
const defaultDevice = 'iphone';

export class GuiEditor {

    constructor() {
        App.registerHook('gui_view_editor', this.initialize.bind(this));
        App.registerHook('gui_menu_initialize', this.registerMenu.bind(this));

        //Guarantee this context
        this.editProperties = this.editProperties.bind(this);
        this.onDocumentChanged = this.onDocumentChanged.bind(this);
        this.onStyleSheetSelected = this.onStyleSheetSelected.bind(this);
        this.onStyleSheetUpdated = this.onStyleSheetUpdated.bind(this);

        $(document).on('tpy:document-changed', this.onDocumentChanged); //New components are create in this document
    }

    initialize(properties) {
        // For compatibility. In the initial definition canEdit was the default parameter.
        if (typeof properties == 'boolean') {
            properties = { canEdit: properties };
        }
        else {
            properties = properties || { canEdit: true };
        }

        //if (canEdit == undefined) this.canEdit = false;
        this.canEdit = !(properties.canEdit === false);
        this.sidebarModel = { canEdit: this.canEdit, closePreview: this.initialize.bind(this) };
        this.contentModel = { responsiveDevice: defaultDevice };

        this.dco = App.data.dco;

        App.ui.editorPlugin = this;

        this.initializeUI();

    }

    initializeUI() {
        const sidebarTpl = TemplateManager.get('sidebar');
        const contentTpl = TemplateManager.get('content');

        contentTpl.link(App.ui.$content, this.contentModel);
        sidebarTpl.link(App.ui.$sidebar, this.sidebarModel);

        $('#tabs').localize().tabs({
            activate: (event, ui) => {
                this.activateTab(ui.newTab, ui.oldTab);
            }
        });
        this.activateTab(App.ui.$sidebar.find('li[data-tab-id="tab-1"]'));
    }

    activateTab(tab, oldTab) {
        let id = this.canEdit ? tab.data().tabId : CONTENT_TAB;
        this.prevContentTemplate = this.contentModel.template;
        this.activeTab = id;
        switch(id) {
            case SHARE_TAB:
                this.displayShareList();
                this.loadContentTab();
                break;
            case CONTENT_TAB:
                this.loadContentTab();
                break;
            case LOOK_TAB:
                this.loadLookAndFeelSidebar();
                this.loadContentTab();
                break;
            case RESOURCES_TAB:
                this.loadResourceTab();
                break;
            default:
                $.observable(this.contentModel).setProperty('template', ['#gui-editor-', id, '-content'].join(''));
                break;
        }
    }

    registerMenu() {
        App.ui.registerMenuItem({ id: 'file'});
        App.ui.registerMenuItem({ id: 'file_properties', show: ['editor']}, 'file');
        App.ui.registerMenuItem({ id: 'file_metadata', show: ['editor']}, 'file');
        App.ui.registerMenuItem({ id: 'file_download', show: ['editor']}, 'file');
        App.ui.registerMenuItem({ id: 'file_exit', show: ['editor']}, 'file');
        App.ui.registerMenuItem({ id: 'view'});
        App.ui.registerMenuItem({ id: 'view_preview', show: ['editor']}, 'view');
        App.ui.registerMenuItem({ id: 'view_responsive', show: ['editor']}, 'view');
        App.ui.registerMenuItem({ id: 'help'});
        App.ui.registerMenuItem({ id: 'help_manual'}, 'help');
        App.ui.registerMenuItem({ id: 'help_about'}, 'help');

        //Register callbacks
        App.registerHook('gui_menu_file_properties', this.editProperties.bind(this));
        App.registerHook('gui_menu_file_metadata', this.openMetadataEditor.bind(this));
        App.registerHook('gui_menu_file_download', this.downloadObject.bind(this));
        App.registerHook('gui_menu_file_exit', this.close.bind(this));
        App.registerHook('gui_menu_view_preview', this.preview.bind(this));
        App.registerHook('gui_menu_view_responsive', this.responsiveView.bind(this));
        App.registerHook('gui_menu_help_manual', this.notimplemented.bind(this));
        App.registerHook('gui_menu_help_about', this.about.bind(this));
        App.registerHook('gui_menu_profile_logout', this.logout.bind(this));
    }

    loadContentTab() {
        if (!this.sidebarModel.content){
            const treeConfig = this.initializeContentTreeManager();
            let extras = this.dco.extras().slice(0);
            $.observable(this.sidebarModel).setProperty('content', {
                extras: extras,
                ...treeConfig
            });
            setTimeout(() => App.ui.$sidebar.localize(), 100);
        }
        $.observable(this.contentModel).setProperty('template', ['#gui-editor-', CONTENT_TAB, '-content', App.ui.responsive ? '-responsive': ''].join(''));
        this.headRendered = false;
        if (this.prevContentTemplate != this.contentModel.template) {
            const selected = this.contentTreeManager.getSelection();
            if (selected) {
                this.contentTreeSelectionHandler(selected);
            }
        }
        //this.renderFirst();
    }

    initializeContentTreeManager() {
        this.contentTreeManager = new ContentTreeManager(
            this.contentTreeActionHandler.bind(this),
            this.contentTreeSelectionHandler.bind(this)
        );
        return this.contentTreeManager.getConfig(this.canEdit);
    }

    contentTreeActionHandler(result) {
        let container = this.editor.container;
        if (/(add|move)/.test(result.action)){
            container = 'content'; //Only content allows moving operations
        }
        this.onDocumentChanged();
        if (result.action == 'add' && !this.editor.isIndex) {
            const node = this.contentTreeManager.getSelection();
            this.renderHead(node).then(() => this.render(node));
        }
        else {
            this.render(this.contentTreeManager.getSelection());
        }
    }

    contentTreeSelectionHandler(node) {
        if (!this.headRendered) {
            this.renderHead(node).then(() => this.render(node));
            this.headRendered = true;
        }
        else {
            this.render(node);
        }
    }

    loadResourceTab() {
        if (!this.sidebarModel.resources) {
            const treeConfig = this.initializeResourceTreeManager();
            $.observable(this.sidebarModel).setProperty('resources', {
                ...treeConfig,
                onAction: this.resourceTreeManager.onSidebarAction
            });

            setTimeout(() => App.ui.$sidebar.localize(), 100);
        }
        $.observable(this.contentModel).setProperty('template', ['#gui-editor-', RESOURCES_TAB, '-content'].join(''));
    }

    initializeResourceTreeManager() {
        this.resourceTreeManager = new ResourceTreeManager({
        }, App);
        this.contentModel.resourceManager = this.resourceTreeManager;
        return this.resourceTreeManager.getConfig();
    }

    displayShareList() {
        const builder = App.ui.components.FormBuilder;
        const validators = App.validation.validators;
        const shareList = App.data.dco.shareList.slice();

        let formConfig = builder.group({
            shareWith: ['shareList', shareList, { label: 'dco.shareList', validators: [], askForDeleteConfirmation: true }]
        });
        $.observable(this.sidebarModel).setProperty('shareConfig', formConfig);
        $.observe(shareList, function(ev, data) {
            if (data.items) {
                const item = data.items[0];
                const user = { email: item.email, role: item.role };
                if (data.change == 'insert') {
                    App.data.dco.grantAccess(user);
                }
                else if (data.change == 'remove') {
                    App.data.dco.revokeAccess(user);
                }
            }
            else if (data.email) {
                App.data.dco.updateAccess({ email: data.email, role: data.role });
            }
        });
        App.ui.$sidebar.localize();
    }

    loadLookAndFeelSidebar() {
        let tree = $('#look_stylesheets').jstree({
            plugins: ['wholerow', 'types'],
            core: {
                multiple: false
            },
            types: {
                default: {
                    icon: 'fas fa-file-code'
                }
            }
        });
        if (tree.on) {
            tree.on('select_node.jstree', this.onStyleSheetSelected);
        }
    }

    onStyleSheetSelected(ev, data) {
        const filename = [this.dco.manifest.baseUrl.replace(/\/+$/, ''), 'css', data.node.id].join('/');
        const onSuccess = this.onStyleSheetUpdated;
        const onError = err => {};
        $.get(filename).done((css) => {
            const editor = new StylesheetEditor({filename: data.node.id, content: css});
            editor.show().then(onSuccess, onError);
        })
        .fail((jqxhr, statusText, error) => {
            console.log(`Failed to load ${filename}. ${statusText} - ${error}`);
            const editor = new StylesheetEditor({filename: data.node.id, content: ''});
            editor.show().then(onSuccess, onError);
        });
    }

    onStyleSheetUpdated(file) {
        const _$ = this.editorWindow.$;
        if (!_$) return;
        //Reload stylesheet
        const style = _$('link[href*="'+file.filename+'"]').get(0);
        if (style) {
            const queryString = '?r=' + new Date().getTime();
            style.href = style.href.replace(/\?.*|$/, queryString);
        }
    }

    openMetadataEditor() {
        let ed = this.metadataEditor;
        if (!ed) {
            ed = new MetadataEditor();
        }
        ed.show();
    }

    //Menu handlers
    close() {
        App.ui.load('home');
    }

    about() {
        if (!this.aboutTpl) this.aboutTpl = $.templates("script#gui-editor-about");
        $(this.aboutTpl.render({ theme: App.options.theme })).dialog({ modal: true});
    }

    logout(){
        App.exit();
    }

    editProperties() {
        const builder = App.ui.components.FormBuilder;
        const validators = App.validation.validators;

        const interactionModes = [
            { value: 'web', label: 'interactionMode.web' },
            { value: 'scorm', label: 'interactionMode.scorm' }
        ];
        const displayModes = [
            { value: 'inline', label: 'displayMode.inline' },
            { value: 'floating', label: 'displayMode.floating' },
            { value: 'modal', label: 'displayMode.modal' }
        ];
        const config = this.dco.manifest;
        const formConfig = builder.array([
            builder.group({
                id: ['label', config.id, { label: 'general.id', small: true }],
            }, { label: '' }),
            builder.group({
                shareAsTemplate: ['yesno', config.shareAsTemplate, { label: 'dco.shareAsTemplate', column: 1 }],
                interactionMode: ['radio', config.interactionMode, { label: 'dco.interactionMode', validators: [ validators.required ], options: interactionModes, column: 1 }],
                preview: ['imageInput', config.preview, { label: 'dco.imagePreview', validators: [], column: 2 }]
            }, { label: 'dco.generalconfig', template: builder.templates.group.twoColumns }),
            builder.group({
                skipHome: ['yesno', config.skipHome, { label: 'dco.skipHome' }],
                displayMode: ['optionList', config.displayMode, { label: 'dco.displayMode', options: displayModes }],
                width: ['text', config.width, { label: 'dco.width', validators:[validators.sizeUnit] , small: true }],
                height: ['text', config.height, { label: 'dco.height', validators:[validators.sizeUnit], small: true }],
            }, { label: 'dco.viewOptions' })
        ]);
        const titleText = config.name + ' - ' + App.i18n.t('dco.propertiesTitle');
        let manager = new App.ui.components.FormManager({formConfig, titleText});
        setTimeout(() => {
            manager.openDialog({ width: '60vw'}).then(updatedProperties => {
                let properties = Object.assign({}, updatedProperties[1]);
                properties = Object.assign(properties, updatedProperties[2]);
                this.dco.update(properties);
            }).catch((err) => {
                console.log(err);
            });
        }, 200);
    }

    preview() {
        if (this.canEdit) {
            this.initialize(!this.canEdit);
        }
    }

    closePreview() {
        this.initialize(true);
    }

    responsiveView(ui) {
        $(ui.item).toggleClass('checked');
        $.observable(App.ui).setProperty('responsive', !App.ui.responsive);
        if (this.activeTab == CONTENT_TAB) {
            const template = ['#gui-editor-', CONTENT_TAB, '-content', App.ui.responsive ? '-responsive': ''].join('');
            $.observable(this.contentModel).setProperty('template', template);
            this.headRendered = false;
            this.contentTreeSelectionHandler(this.contentTreeManager.getSelection());
            //this.renderFirst();
        }

        App.ui.$content.toggleClass('responsive-view');
        if (App.ui.responsive) {
            $.observe(this.contentModel, 'responsiveDevice', this.onDeviceChanged.bind(this));
            App.ui.$content.addClass(this.contentModel.responsiveDevice);
        }
        else {
            $.unobserve(this.contentModel, 'responsiveDevice');
            App.ui.$content.removeClass(this.contentModel.responsiveDevice);
        }
    }

    onDeviceChanged(ev, args) {
        let oldDevice = args.oldValue || defaultDevice;
        App.ui.$content.removeClass(oldDevice).addClass(this.contentModel.responsiveDevice);
    }

    notimplemented(){
        alert('Esta opción aún no se ha implementado');
    }

    renderHead(node) {
        const $frame = $('#editor-container-frame');
        this.editor = $frame.get(0);
        if (node.id == '_root') {
            this.editor.isIndex = true;
            this.editor.container = 'index';
        }
        else {
            this.editor.isIndex = false;
            this.editor.container = 'content';
        }

        $frame.off('load').on('load', () => {
            const $content = $frame.contents();
            const $head = $content.find('head');
            if (App.ui.responsive) {
                $head.append('<meta name="viewport" content="width=device-width, initial-scale=1.0" />');
            }

            /*if (this.canEdit) {
                this.tepuyApp.enterEditMode();
            }*/

            if (this.canEdit) {
                const template = TemplateManager.get('pageViewStyles');
                $head.append(template.render());
            }
            this.registerEventHandlers();
            $(App.data.dco.getDocument(this.editor.container))
                .trigger('tpy:editor-loaded', [this.editorWindow])
                .off('tpy:document-changed') //prevent multiple registration of the same event
                .on('tpy:document-changed', this.onDocumentChanged);
            this.editor.resolve();
        });
        const html = App.data.dco.getHtml(this.editor.container, this.canEdit);
        let promise = new Promise((resolve, reject) => {
            this.editor.resolve = resolve;
            this.editor.reject = reject;
            this.editor.srcdoc = html; //HTML5 only property
            this.editorWindow.srcDocument = this.editorWindow.document;
        });
        return promise;
    }

    render(node) {
        let section;
        if (node.id == '_root') {
            if (!this.editor.isIndex) {
                this.renderHead(node);
                return;
            }
        }
        else {
            if (this.editor.isIndex) {
                this.renderHead(node).then(() => this.render(node));
                return;
            }

            if (node.type == 'page') {
                const page = App.data.dco.getPage(node.id);
                section = page.getSectionAt(0);
                this.loadPageInEditor(page, section);
            }
            else {
                if (node.parent == '_floating') {
                    return; //ToDo: Need to display the hidden section
                }
                else {
                    const page = App.data.dco.getPage(node.parent);
                    section = page.getSection(node.id);
                    this.loadPageInEditor(page, section);
                }
            }
        }
        return;
    }

    get editorWindow() {
        return this.editor.contentWindow;
    }
    get tepuyApp() {
        return this.editorWindow.dhbgApp;
    }

    loadPageInEditor(page, section) {
        const pageIndex = App.data.dco.pages.indexOf(page);
        const sectionIndex = page.sections.indexOf(section);
        this.tepuyApp.mainWindow = this.editorWindow;
        this.tepuyApp.loadPage(pageIndex, sectionIndex);
    }

    registerEventHandlers() {
        const _$ = this.editorWindow.$;
        const $document = _$(this.editorWindow.document);
        $document.on('tpy:scorm.playing', (ev) => {
            ev.preventDefault();
            const page = App.data.dco.pages[0];
            page && this.contentTreeManager.setSelection(page.id);
        });

        if (!this.canEdit) return;

        $document.on('click', '[data-cmpt-type] .tpy-action', (ev) => {
            const $target = _$(ev.target); //Need to use jQuery form the frame window so it has all the tepuy plugins added
            const data = $target.data();
            if (/^add/.test(data.tpyAction)) {
                this.appendComponentDialog(data, $target, data.tpyAction);
            }
            else if (data.tpyAction == 'remove') {
                this.removeComponent(data, $target);
            }
            else if (/^move-(up|down)$/.test(data.tpyAction)) {
                this.moveComponent(data, $target);
            }
            else if (data.tpyAction == 'edit') {
                this.editComponent(data, $target);
            }
        }).on('mouseover', '[data-cmpt-type]', function(e) {
            e.stopImmediatePropagation();
            _$('.tpy-edit-toolbar.'+this.id).show();
        }).on('mouseout', '[data-cmpt-type]', function(e) {
            e.stopImmediatePropagation();
            _$('.tpy-edit-toolbar.'+this.id).hide();
        });
    }

    appendComponentDialog(data, $target, action) {
        const $cmpt = $target.closest('[data-cmpt-type]');
        const cmptEl = $cmpt.get(0);
        const id = cmptEl.id;
        let ed = this.componentEditor;
        if (!ed) {
            ed = this.createComponentEditor($target);
        }
        ed.setTitle(App.i18n.t('component.addTitle'));
        ed.setAcceptText(App.i18n.t('commands.add'));
        //Find the parent by id then append the selected node
        let parent = App.data.dco.getComponent(id, this.editor.container);
        const options = { refEl: $cmpt };
        if (action == 'add-before') {
            options.position = 'before';
            parent = parent.parent;
        }
        else if (action == 'add-after') {
            options.position = 'after';
            parent = parent.parent;
        }
        ed.parent = parent; //Set the parent so it can be used to get properties required on their children
        ed.show({
            $refEl: $cmpt
        }).then((child) => {
            parent.appendChild(child, options);
            parent.parser.registerComponent(child, this.editor.container); //Required for the dco.getComponent() method to work with new added components
            this.onDocumentChanged();
        }, (err) => {
            if (err == null) return; //Dialog cancelled
            //ToDo: handle error.
        });
    }

    editComponent(data, $target) {
        const $cmpt = $target.closest('[data-cmpt-type]');
        const id = $cmpt.get(0).id;

        let ed = this.componentEditor;
        if (!ed) {
            ed = this.createComponentEditor($target);
        }

        ed.setTitle(App.i18n.t('component.editTitle'));
        ed.setAcceptText(App.i18n.t('commands.accept'));
        const component = App.data.dco.getComponent($cmpt.get(0).id, this.editor.container);
        component.$host = $cmpt;
        ed.parent = component.parent;
        ed.show({
            component,
            $refEl: $cmpt
        }).then((cmpt) => {
            //update Html
            component.parser.updateComponentRegistration(this.editor.container, id, cmpt.id);
            this.onDocumentChanged();
            ed.parent && ed.parent.onChildUpdated(cmpt);
        }, (err) => {
            if (err == null) return; //Dialog cancelled
            //ToDo: handle error.
        });
    }

    createComponentEditor($refEl) {
        const refEl = $refEl.get(0);
        const docEl = refEl.ownerDocument;
        const refW = (docEl.defaultView || docEl.parentWindow);
        const jQuery = refW && refW.jQuery || refW.$ || $refEl.find(':root'); //Get the jQuery object.
        return (this.componentEditor = new ComponentEditor(jQuery));
    }

    removeComponent(data, $target) {
        const $cmpt = $target.closest('[data-cmpt-type]');
        const text = 'component.deleteConfirmation';
        const question = App.i18n.t(text, {  }, {interpolation: {escapeValue: false}});
        const title = App.i18n.t('component.deleteTitle');

        App.ui.components.Dialog.confirm(question, title).then(result => {
            if (!result) return;
            const component = App.data.dco.getComponent($cmpt.get(0).id, this.editor.container);
            component.$host = $cmpt;
            if (component) {
                component.parser.unregisterComponent(component);
                component.remove(); //Remove the node from the tree
                this.onDocumentChanged();
            }
        });
    }

    moveComponent(data, $target) {
        const direction = data.tpyAction.replace('move-', '');
        const $cmpt = $target.closest('[data-cmpt-type]');
        const id = $cmpt.get(0).id;
        const component = App.data.dco.getComponent(id, this.editor.container);
        component.$host = $cmpt;
        const parent = component.parent;

        if (data.tpyAction == 'move-up') {
            parent.moveUp(component);
        }
        else {
            parent.moveDown(component);
        }
        this.onDocumentChanged();
    }

    onDocumentChanged() {
        App.data.dco.updateHtml(this.editor.container);
    }

    resize($viewer) {
        let height = $viewer.get(0).contentWindow.document.documentElement.scrollHeight + 'px';
        $viewer.css({height: height});
    }

    downloadObject() {
        App.data.dco.download().then(url => {
            setTimeout(() => {
                downloadFile(url, filenamify(App.data.dco.name) + '.zip');
            }, 10);
        }, err => {
            App.ui.components.Dialog.message(App.i18n.t('dco.downloadFailure'), App.i18n.t('tepuy'));
        });
    }
}
