import { App } from '../../js/app';

export class GuiDefault {

    constructor() {
        App.registerHook('gui_initialize', this.initialize.bind(this));
        this.menu = [
            { text: 'Save', icon: 'ui-icon-disk'},
            { text: 'Zoom In', icon: 'ui-icon-zoomin'}
        ];
    }

    initialize() {
        const template = $.templates("script#gui-default");
        template.link(App.container, {}); /*{
            menuItems: this.menu
        }
        }, {
            menuAction: this.menuClick
        });*/
        App.ui = {
            $sidebar: $('#tpe-sidebar'),
            $content: $('#tpe-content'),
            load: this.load.bind(this)
        };
    }

    menuClick(ev, ui) {
        console.log('menuClick');
        if (!ui.item.children("ul").length) {
          // Leaf menu item
          alert(ui.item.text());
        }
    }

    load(page) {
        App.invokeHook('gui_templatechooser');
    }

}