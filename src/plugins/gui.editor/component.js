import { App } from '../../js/app';
import i18next from 'i18next';

export class GuiEditor {

    constructor() {
        App.registerHook('gui_editor', this.initialize.bind(this));
        this.menu = [
            { text: 'Save', icon: 'ui-icon-disk'},
            { text: 'Zoom In', icon: 'ui-icon-zoomin'}
        ];
    }

    initialize() {
        const sidebarTpl = $.templates("script#gui-editor-sidebar");
        sidebarTpl.link(App.ui.$sidebar, {});
        const contentTpl = $.templates("script#gui-editor-content");
        contentTpl.link(App.ui.$content, {});

        $('#tabs').localize().tabs();
    }
}