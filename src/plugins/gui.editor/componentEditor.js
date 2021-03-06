import { App } from '../../js/app';
import { privateMap, _ } from '../../js/utils';
import { Component } from '../../js/component';
import { TemplateManager } from './templateManager';

export class ComponentEditor {
    constructor(jQuery) {
        this.jQuery = jQuery;
        const dlg = new App.ui.components.Dialog({
            title: '',
        });
        const acceptBtn = { text: App.i18n.t('commands.add'), click: this.submit.bind(this), 'data-default': true };
        const cancelBtn = { text: App.i18n.t('commands.cancel'), click: this.cancel.bind(this) };
        dlg.setButtons([acceptBtn, cancelBtn]);
        const template = TemplateManager.get('componentLookup')
        privateMap.set(this, {
            dlg,
            acceptBtn,
            cancelBtn,
            template,
            components: Object.keys(Component.registry).map((key, i) => { 
                const entry = Component.registry[key];
                const t = App.i18n.getFixedT(null, entry.ns);
                return {name: t(key+'.title'), category: entry.ctor.type, ctor: entry.ctor, icon: entry.ctor.iconName }; 
            })
        });
        this.filter = {
            keyword: '',
            categories: {
                textblock: true,
                multimedia: true,
                layout: true,
                activity: true
            }
        };

        this.allowActivities = true;

        this.allCategories = [
            { id: 'textblock', label:'component.category.textblock', enabled: true },
            { id: 'multimedia', label:'component.category.multimedia', enabled: true },
            { id: 'layout', label:'component.category.layout', enabled: true },
            { id: 'activity', label:'component.category.activity', enabled: true },
        ];
    }

    get categories() {
        return this.allCategories.filter(c => c.enabled);
    }

    get components() {
        if (!this.filteredComponents) {
            this.applyFilter();
        }
        return this.filteredComponents;
    }

    applyFilter() {
        let items = _(this).components;
        let filterFn = (it) => {
            return this.filter.categories[it.ctor.type] && (!this.parent || !this.parent.acceptChild || this.parent.acceptChild(it));
        };
        const oldvalue = this.filteredComponents;
        this.filteredComponents = items.filter(filterFn);
        $.observable(this)._trigger(this, {change: "set", path: 'components', value: this.filteredComponents, oldValue: oldvalue, remove: undefined});
    }

    setActivitiesAllowed(allowed) {
        this.allowActivities = allowed;
        this.filter.categories['activity'] = allowed;
        this.applyFilter();
    }

    setTitle(title) {
        const priv = _(this);
        if (priv.initialized) {
            priv.dlg.host.dialog('option', 'title', title);
        }
        else {
            priv.dlg.host.attr('title', title);
        }
    }

    setAcceptText(text) {
        const priv = _(this);
        priv.acceptBtn.text = text;
        if (priv.initialized) {
            priv.dlg.host.find('.ui-dialog-buttonset > button:first').html(text);
        }
    }

    show(options) {
        this.filteredComponents = null;
        const { component, $refEl } = { ...options };
        const priv = _(this);
        const dlg = priv.dlg;
        const me = this;
        this.setMode('loading');
        this.selected = component;
        if (!this.selected && this.components.length == 1) {
            const selected = this.components[0];
            this.selected = new selected.ctor();
        }
        this.objBaseUri = $refEl.get(0).baseURI;

        if (!priv.initialized) {
            dlg.create({
                open: this.onDialogOpen.bind(this)
            });
            dlg.host.addClass('tpy-component-editor')
            dlg.host.empty();
            priv.template.link(dlg.host, this)
            $.observe(this, 'mode', () => {
                dlg.host && dlg.host.localize();
            });
            priv.initialized = true;
        }

        return new Promise((resolve, reject) => {
            priv.resolve = resolve;
            priv.reject = reject;
            dlg.showModal();
        });
    }

    onDialogOpen() {
        const dlg = _(this).dlg;
        dlg.toggleFullMode(true);
        this.selected && this.enterEditMode();
        dlg.host.localize();
        setTimeout(() => {
            this.setMode(this.selected ? 'edit' : 'lookup');
        }, 0);
    }

    setMode(mode) {
        $.observable(this).setProperty('mode', mode);
    }

    enterEditMode() {
        const builder = App.ui.components.FormBuilder;
        const validators = App.validation.validators;

        const cmpt = this.selected;
        const controls = {
            id: ['text', cmpt.id, { label: 'component.id', required: true, validators: [ validators.required, validators.pattern(validators.patterns.HTMLCLASSNAME)] }],
            //name: ['text', cmpt.name, { label: 'component.name', validators: [validators.required, validators.maxLength(60) ], maxLength: 60, default: true }],
        };
        cmpt.onEditBefore({
            baseURI: this.objBaseUri
        });
        let properties = cmpt.properties.slice();
        if (this.parent && this.parent.childProperties) {
            const childProperties = this.parent.resolveChildProperties(this.jQuery); // .childProperties.slice();
            for(let i = 0; i < childProperties.length; i++) {
                const pName = childProperties[i].name;
                const cmptValue = cmpt.getPropertyValue(pName);
                childProperties[i].value = (cmptValue == undefined) ? childProperties[i].value : cmptValue;
            }
            properties = [...childProperties, ...properties];
        }
        const length = properties.length;
        for(let i = 0; i < length; i++) {
            const prop = properties[i];
            controls[prop.name] = [prop.type, prop.value, prop.editSettings];
        }

        this.form = builder.group(controls);
    }

    submit() {
        const priv = _(this);
        if (this.mode == 'lookup') {
            //Verify there is one selected. Then add it.
            const selected = this.components[this.selectedIndex];
            if (!selected) {
                App.ui.components.Dialog.message(App.i18n.t('component.errors.componentRequired'), App.i18n.t('tepuy'));
                return;
            }
            //const type = Component.registry[selected.rindex];
            this.selected = new selected.ctor();
            this.enterEditMode();
            this.setMode('edit');
            return;
        }
        $.observable(this.form).setProperty('submitted', true);
        if (!this.form.valid) {
            App.ui.components.Dialog.message(App.i18n.t('component.errors.invalidInformation'), App.i18n.t('tepuy'));
            return; //Form is not valid. //ToDo: Show errors
        }
        const value = this.form.value;
        this.selected.id = value.id;
        if (this.parent) this.selected.parent = this.parent;
        this.selected.updateProperties(value);
        /*for(let prop in value) {
            if (prop == 'id') continue;
            this.selected.setPropertyValue(prop, value[prop]);
        }*/
        priv.resolve(this.selected); //Resolve with the selected component.
        this.form = null;
        this.selected = null;
        priv.dlg.close();
    }

    cancel() {
        this.form = null;
        this.selected = null;
        _(this).dlg.close();
        _(this).reject();
    }
}