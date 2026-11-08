import { App } from '../../js/app';
import { Validators } from './components/validators';

import { helpers, converters, tree, imageInput, icon, svgIcon } from './helpers';

import { shareList } from './tags/shareList';
import { jstree } from './tags/jstree';
import { selectableList } from './tags/selectableList';
import { htmleditor } from './tags/htmleditor';
import { tooltip } from './tags/tooltip';
import { formCollection } from './tags/formCollection';
import { resourceInput } from './tags/resourceInput';

import { FormManager, FormBuilder, FormArray, FormControl, FormGroup } from './components/formManager';
import { Dialog } from './components/dialog';
import { ResourceLookup } from './components/resourceLookup';

let layoutInitialized = false;

export class GuiDefault {

    constructor() {
        App.registerHook('gui_initialize', this.initialize.bind(this));
        this.menu = [];

        //Guarantee this context
        this.menuAction = this.menuAction.bind(this);
    }

    initialize() {
        $.views.helpers(helpers);
        $.views.tags({
            editableTree: tree,
            shareList,
            imageInput,
            icon,
            jstree,
            selectableList,
            htmleditor,
            svgIcon,
            tooltip,
            formCollection,
            resourceInput
        });
        $.views.converters(converters);
        this.initializeGuiApi();
        App.invokeHook('gui_menu_initialize');
    }

    initializeGuiApi() {

        //Allow interactions for tinymce editor and ace editor
        $.widget("ui.dialog", $.ui.dialog, {
            _allowInteraction: function (event) {
                return !!$(event.target).closest(".tox-tinymce-aux, .moxman-window, .tam-assetmanager-root, .ace_editor").length || this._super(event);
            }
        });

        App.ui = {
            load: this.load.bind(this),
            registerMenuItem: this.registerMenuItem.bind(this),
            components: {
                FormManager,
                FormBuilder,
                FormArray,
                FormGroup,
                FormControl,
                Dialog,
                ResourceLookup
            }
        };
        App.validation = { validators: {...Validators }};
    }

    menuAction(ev, ui) {
        if (ui.item.children("ul").length) return; //Not a leaf
        var hook = `gui_menu_${ui.item.data().id}`;
        //setTimeout(() => App.ui.$menu.menu('collapseAll', true), 200);
        setTimeout(() => {
            //App.ui.$menu.menu('collapseAll', true);
            App.invokeHook(hook, ui);
            setTimeout(() => App.ui.$menu.menu('collapseAll', true), 200);
        }, 0);
    }

    buildLayout() {
        const template = $.templates("script#gui-default");
        this.profile_menu = [];
        this.user = App.data.user;
        this.theme = App.options.theme;
        this.showProfileMenu = App.options.profileMenu;
        if (App.options.exit) {
            const exitText = App.options.exit.text || App.i18n.t('menu.profile_logout');
            this.profile_menu.push({ id: 'profile_logout', icon: 'profile_logout', text: exitText });
        }
        template.link(App.$container, this);
        let $menu = App.ui.$menu = $('#tpy-menubar');
        App.ui.$sidebar = $('#tpy-sidebar');
        App.ui.$content = $('#tpy-content');

        $menu.menu({
            position: { my: 'left top', at: 'left bottom' },
            blur: () => {
                $menu.menu('option', 'position', { my: 'left top', at: 'left bottom' });
            },
            focus: (e, ui) => {
                if ($menu.get(0) !== $(ui).get(0).item.parent().get(0)) {
                    $menu.menu('option', 'position', { my: 'left top', at: 'right top' });
                }
            }
        });
        $(App.$container).addClass("tpy-editor tpy-editor-default").localize(); //ToDo: Change default to the theme name
        layoutInitialized = true;
    }

    load(view, params) {
        this.currentView = view;
        if (!layoutInitialized) {
            this.buildLayout();
        }
        App.invokeHook(`gui_view_${view}`, params);
        this.resolveMenuState(this.menu);
        //$.observable(this.menu).refresh(this.menu);
        App.ui.$menu.menu("refresh");
    }

    registerMenuItem(menuItem, parentId) {
        var container = this.menu;
        let item = { ...menuItem };
        if (parentId) {
            var parent = container.find(it => it.id == parentId);
            container = parent && (parent.menuItems || (parent.menuItems = [])) || container;
        }
        $.observable(container).insert(item);
    }

    resolveMenuState(menuItem) {
        if (Array.isArray(menuItem)) {
            for(let item of menuItem) {
                this.resolveMenuState(item);
            }
            return;
        }

        let enabled = false;
        let visible = false;
        if (menuItem.menuItems && menuItem.menuItems.length) {
            for(let item of menuItem.menuItems) {
                this.resolveMenuState(item);
                enabled = enabled || item.enabled;
                visible = visible || item.visible;
            }
            //menuItem.enabled = enabled;
            //menuItem.visible = visible;
            $.observable(menuItem).setProperty('enabled', enabled);
            $.observable(menuItem).setProperty('visible', visible);
            return;
        }

        if (Array.isArray(menuItem.show)) {
            visible = menuItem.show.indexOf(this.currentView) >= 0;
        }
        else {
            visible = true;
        }

        if (Array.isArray(menuItem.enable)) {
            enabled = menuItem.enable.indexOf(this.currentView) >= 0;
        }
        else {
            enabled = true;
        }

        //menuItem.enabled = enabled;
        //menuItem.visible = visible;
        $.observable(menuItem).setProperty('enabled', enabled);
        $.observable(menuItem).setProperty('visible', visible);
    }
}