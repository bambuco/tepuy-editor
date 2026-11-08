import { App } from '../../../js/app';
import { privateMap, _, getSafe, newid } from '../../../js/utils';
import { Dialog } from './dialog';

export const VALID = 'VALID';
export const INVALID = 'INVALID';
export const DISABLED = 'DISABLED';

const filterByColumn = function(item, index, items) {
    return item.prop.settings.column == this.props.column;
};

export class FormManager {

    constructor({formConfig,
        titleText = '',
        acceptText = 'commands.accept',
        cancelText = 'commands.cancel',
        template = '#gui-default-form-container'
    }) {
        this.formConfig = formConfig;
        this.template = template;
        this.titleText = titleText;
        this.acceptText = acceptText;
        this.cancelText = cancelText;
        privateMap.set(this, {});
    }

    get value() {
        return this.formConfig.value;
    }

    openDialog(options) {
        const priv = _(this);
        priv.template = $.templates(this.template);
        const dlg = new Dialog(Object.assign({
            title: App.i18n.t(this.titleText),
            centerOnContent: true
        }, options));
        dlg.setButtons([
            { text: App.i18n.t(this.acceptText), click: this.submit.bind(this), 'data-default': true },
            { text: App.i18n.t(this.cancelText), click: this.cancel.bind(this) }
        ]);
        dlg.create();

        priv.template.link(dlg.host, this, {
            byColumn: filterByColumn
        });
        dlg.host.localize();
        priv.dialog = dlg;

        return new Promise((resolve, reject) => {
            priv.resolve = resolve;
            priv.reject = reject;
            dlg.showModal();
        });
    }

    displayTo(element) {
        const priv = _(this);
        priv.template = $.templates(this.template);
        priv.template.link($(element), this);
        $(element).localize();
    }

    submit() {
        if (this.formConfig.valid) {
            _(this).dialog.close(true);
            _(this).resolve(this.formConfig.value);
            return;
        }
        $.observable(this).setProperty('submitted', true);
    }

    cancel() {
        //ask for confirmation
        if (this.formConfig.dirty) {
            //ToDo: ask for confirmation
        }
        _(this).dialog.close(true);
        _(this).reject('cancelled');
    }
}

export class AbstractControl {
    constructor(template, settings) {
        this.id = newid();
        privateMap.set(this, {
            status: INVALID,
            validators: getSafe(settings, 'validators', null),
            template: template,
            settings: settings
        });

        if (settings && settings.depends) {
            this.visible = this.visible.bind(this);
            this.visible.depends = Array.isArray(settings.depends) ?
                settings.depends.map(dep => ['parent.value.', dep].join('')) :
                [['parent.value.', settings.depends].join('')];
        }

        this._onDependencyValueChanged = this._onDependencyValueChanged.bind(this);

        $.observe(this, 'value', (ev, data) => {
            this.updateValidity();
            $(this).trigger('tpy:valueChanged', data);
        });
    }

    /*get parent() {
        return _(this).parent;
    }*/

    get valid() {
        return _(this).status === VALID;
    }

    get invalid() {
        return _(this).status === INVALID;
    }

    get disabled() {
        return _(this).status === DISABLED;
    }

    get enabled() {
        return _(this).status !== DISABLED;
    }


    get required() {
        return this.settings.required;
    }

    get template() {
        return _(this).template;
    }

    get label() {
        return getSafe(_(this).settings, 'label', '');
    }

    get info() {
        return getSafe(_(this).settings, 'info', '');
    }

    get settings() {
        return _(this).settings || {};
    }

    visible() {
        const visible = this.settings.visible;
        if (visible === false) return false;
        if (typeof visible === 'function') {
            return visible();
        }
        return true;
    }

    is(status) {
        return _(this).status === status;
    }

    setValue(value) {
        $.observable(this).setProperty({ value });
    }

    setParent(parent) {
        if (this.parent) {
            $.unobserve(this.parent, this._onDependencyValueChanged);
        }
        this.parent = parent;
        //_(this).parent = parent;
        const settings = _(this).settings;
        if (settings && settings.validityDepends) {
            const dependencies = Array.isArray(settings.validityDepends) ?
                settings.validityDepends.map(dep => ['value.', dep].join('')) :
                [['value.', settings.depends].join('')];

            $.observe.apply($, [this.parent, ...dependencies, this._onDependencyValueChanged]);
        }
    }

    _onDependencyValueChanged() {
        this.updateValidity();
    }

    setValidator(validator) {
        _(this).validator = validator
    }

    runValidator() {
        let validators = _(this).validators;
        if (validators == null) {
            //_(this).status = VALID;
            return;
        }
        if (!Array.isArray(validators)) {
            return validators(this);
        }

        let errors = [];
        validators.forEach(fn => {
            let result = fn(this);
            if (result) {
                const key = Object.keys(result)[0];
                const langKey = result.ns ? result.ns+':' : '' + `validation-errors.${key}`;
                result.msg = result[key] === true ? App.i18n.t(langKey, result.data) : result[key];
                errors.push(result);
            }
        });

        if (errors.length) {
            return errors;
        }
        return null;
    }

    _calculateStatus() {
        if (this._allControlsDisabled()) return DISABLED;
        if (this.errors) return INVALID;
        //if (this._anyControlsHaveStatus(PENDING)) return PENDING;
        if (this._anyControlsHaveStatus(INVALID)) return INVALID;
        return VALID;
    }

    _allControlsDisabled() {
        return false;
    }

    _anyControlsHaveStatus(status) {
        return false;
    }

    updateValidity() {
        $.observable(this).setProperty('errors', this.runValidator());
        const [valid, invalid, enabled, disabled] = [this.valid, this.invalid, this.enabled, this.disabled];
        _(this).status = this._calculateStatus();
        //Raise property change trigger ($.observable)
        (valid != this.valid) && $.observable(this)._trigger(this, {change: "set", path: 'valid', value: this.valid, oldValue: valid, remove: undefined});
        (invalid != this.invalid) && $.observable(this)._trigger(this, {change: "set", path: 'invalid', value: this.invalid, oldValue: invalid, remove: undefined});
        (enabled != this.enabled) && $.observable(this)._trigger(this, {change: "set", path: 'enabled', value: this.enabled, oldValue: enabled, remove: undefined});
        (disabled != this.disabled) && $.observable(this)._trigger(this, {change: "set", path: 'disabled', value: this.disabled, oldValue: disabled, remove: undefined});

        if (this.parent) {
            this.parent.updateValue();
        }
    }
}

export class FormControl extends AbstractControl {
    constructor(template, settings) {
        super(template, settings);
        this.value = getSafe(settings, 'value', getSafe(settings, 'defaultValue', null));
    }

    _allControlsDisabled() {
        return this.disabled;
    }

    _anyControlsHaveStatus(status) {
        return false;
    }
}

export class FormGroup extends AbstractControl {
    constructor(controls, settings) {
        super(getSafe(settings, 'template', FormBuilder.templates.group.default), settings);
        _(this).controls = controls;
        Object.keys(controls).forEach(key => {
            controls[key].setParent(this);
            controls[key].updateValidity();
        });
        this.updateValue();
    }

    get controls() {
        return _(this).controls;
    }

    registerControl(name, control) {
        let priv = _(this);
        if (priv.controls[name]) return priv.controls[name];
        priv.controls[name] = control;
        control.setParent(this);
    }

    addControl(name, control) {
        this.registerControl(name, control);
        $.observable(this.value).setProperty(name, control.value);
        this.updateValidity()
    }

    removeControl(name) {
        let priv = _(this);
        if (!priv.controls[name]) return;
        delete (priv.controls[name]);
        $.observable(this.value).removeProperty(name);
        this.updateValidity()
    }

    setControl(name, control) {
        let priv = _(this);
        delete (priv.controls[name]);
        if (control) this.addControl(name, control);
    }

    setValue(value) {
        let priv = _(this);
        Object.keys(value).forEach(name => {
            if (priv.controls[name]) {
                priv.controls[name].setValue(value[name]);
            }
        });
        this.updateValue();
    }

    updateValue() {
        let priv = _(this);
        let val = {};

        Object.keys(priv.controls).forEach(name => {
            val[name] = Array.isArray(priv.controls[name].value) ? priv.controls[name].value.slice(0) : priv.controls[name].value;
            if (this.value && this.value[name] != val[name]) {
                $.observable(this.value).setProperty(name, val[name]);
            }
        });
        if (!this.value && val) {
            $.observable(this).setProperty('value', val);
        }
        this.updateValidity();
    }

    _allControlsDisabled() {
        let priv = _(this);
        for(const ctrlName of Object.keys(priv.controls)) {
            if (priv.controls[ctrlName].enabled) return false;
        }
        return Object.keys(priv.controls).length > 0 || this.disabled;
    }

    _anyControlsHaveStatus(status) {
        let priv = _(this);
        for(const ctrlName of Object.keys(priv.controls)) {
            if (priv.controls[ctrlName].is(status)) return true;
        }
        return false;
    }
}

export class FormArray extends AbstractControl {
    constructor(controls, settings) {
        super(getSafe(settings, 'template', FormBuilder.templates.array.default), settings);
        _(this).controls = controls;
        controls.forEach((ctrl, i) => {
            this.registerControl(ctrl, i);
        });
        this.updateValue();
    }

    get controls() {
        return _(this).controls;
    }

    at(index) {
        return _(this).controls[index];
    }

    registerControl(control, i) {
        control.setParent(this);
        control.key = i;
    }

    push(control) {
        $.observable(_(this).controls).insert(control);
        this.registerControl(control);
        this.updateValue();
    }

    insert(index, control) {
        $.observable(_(this).controls).insert(index, control);
        this.registerControl(control);
        this.updateValue();
    }

    removeAt(index) {
        $.observable(_(this).controls).remove(index);
        this.updateValue();
    }

    setControl(index, control) {
        $.observable(_(this).controls).remove(index);
        if (control) {
            this.insert(index, control);
        }
    }

    get length() {
        return _(this).controls ? _(this).controls.length : 0;
    }

    setValue(value) {
        let priv = _(this);
        value.forEach((val, index) => {
            if (this.at[index]) {
                this.at[index].setValue(value);
            }
        });
        this.updateValue();
    }

    updateValue() {
        let priv = _(this);
        let val = [];
        priv.controls.forEach((control, index) => {
            val[index] = Array.isArray(control.value) ? control.value.slice(0) : control.value;
        });
        $.observable(this).setProperty('value', val);
        this.updateValidity();
    }

    _allControlsDisabled() {
        let priv = _(this);
        for(const ctrl of priv.controls) {
            if (ctrl.enabled) return false;
        }
        return priv.controls.length > 0 || this.disabled;
    }

    _anyControlsHaveStatus(status) {
        let priv = _(this);
        for(const ctrl of priv.controls) {
            if (ctrl.is(status)) return true;
        }
        return false;
    }
}

export class FormBuilder {
    static get templates() {
        return {
            text: {
                default: '#gui-default-form-text'
            },
            number: {
                default: '#gui-default-form-number'
            },
            radio: {
                default: '#gui-default-form-radio'
            },
            boolean: {
                default: '#gui-default-form-boolean'
            },
            yesno: {
                default: '#gui-default-form-yesornot'
            },
            optionList: {
                default: '#gui-default-form-optionlist'
            },
            shareList: {
                default: '#gui-default-form-sharelist'
            },
            imageInput: {
                default: '#gui-default-form-imageinput'
            },
            resourceInput: {
                default: '#gui-default-form-resourceinput'
            },
            group: {
                default: '#gui-default-form-group',
                twoColumns: '#gui-default-form-group-two-columns'
            },
            array: {
                default: '#gui-default-form-array'
            },
            html: {
                default: '#gui-default-form-html'
            },
            customtag: {
                default: '#gui-default-form-customtag'
            },
            duration: {
                default: '#gui-default-form-duration'
            },
            longDuration: {
                default: '#gui-default-form-longduration'
            },
            vcard: {
                default: '#gui-default-form-vcard'
            },
            label: {
                default: '#gui-default-form-label'
            }
        };
    }

    static control(defTemplate, value, settings) {
        const ctrl = new FormControl(getSafe(settings, 'template', defTemplate), settings);
        const defaultValue = getSafe(settings, 'defaultValue', value);
        ctrl.setValue(value == null ? defaultValue : value);
        return ctrl;
    }

    static text(value, settings) {
        return FormBuilder.control(FormBuilder.templates.text.default, value, settings);
    }

    static number(value, settings) {
        return FormBuilder.control(FormBuilder.templates.number.default, value, settings);
    }

    static radio(value, settings) {
        return FormBuilder.control(FormBuilder.templates.radio.default, value, settings);
    }

    static boolean(value, settings) {
        return FormBuilder.control(FormBuilder.templates.boolean.default, value, settings);
    }

    static yesno(value, settings) {
        return FormBuilder.control(FormBuilder.templates.yesno.default, value, settings);
    }

    static optionList(value, settings) {
        return FormBuilder.control(FormBuilder.templates.optionList.default, value, settings);
    }

    static shareList(value, settings) {
        return FormBuilder.control(FormBuilder.templates.shareList.default, value, settings);
    }

    static imageInput(value, settings) {
        return FormBuilder.control(FormBuilder.templates.imageInput.default, value, settings);
    }

    static resourceInput(value, settings) {
        return FormBuilder.control(FormBuilder.templates.resourceInput.default, value, settings);
    }

    static html(value, settings) {
        return FormBuilder.control(FormBuilder.templates.html.default, value, settings);
    }

    static customtag(value, settings) {
        return FormBuilder.control(FormBuilder.templates.customtag.default, value, settings);
    }

    static duration(value, settings) {
        return FormBuilder.control(FormBuilder.templates.duration.default, value, settings);
    }

    static longDuration(value, settings) {
        if (!settings.defaultValue) settings.defaultValue = {};
        return FormBuilder.control(FormBuilder.templates.longDuration.default, value, settings);
    }

    static vcard(value, settings) {
        return FormBuilder.control(FormBuilder.templates.vcard.default, value, settings);
    }

    static label(value, settings) {
        return FormBuilder.control(FormBuilder.templates.label.default, value, settings);
    }

    static group(controlsConfig, settings){
        const controls = {};
        Object.keys(controlsConfig).forEach(name => {
            controls[name] = FormBuilder._createControl(controlsConfig[name]);
            controls[name].key = name;
        });
        return new FormGroup(controls, settings);
    }

    static array(controlsConfig, settings) {
        let controls;
        if (Array.isArray(controlsConfig)) {
            controls = controlsConfig.map((c, i) => {
                return FormBuilder._createControl(c)
            });
        }
        else {
            controls = [FormBuilder._createControl(controlsConfig)];
        }
        return new FormArray(controls, settings);
    }

    static collection(controlsConfigFn, value, settings) {
        let controls = [];
    }

    static _createControl(config) {
        if (config instanceof FormControl || config instanceof FormGroup || config instanceof FormArray) {
            return config;
        }

        if (Array.isArray(config)) {
            const type = config[0];
            const value = config.length > 1 ? config[1] : null;
            const settings = config.length > 2 ? config[2] : null;
            if (!FormBuilder[type]) {
                throw TypeError('Missing control type ' + type);
            }
            return FormBuilder[type](value, settings);
        }
        else {
            return FormBuilder[config.type](config.value, config.settings);
        }
    }
}