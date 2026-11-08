import { App } from '../../../js/app';
import { privateMap, _, getSafe } from '../../../js/utils';

export class Dialog {

    constructor(settings) {
        this.host = settings.host;
        this.orphan = false;
        if (!this.host) {
            this.host = $('<div style="display:none"/>').appendTo(App.$container);
            this.orphan = true;
        }
        privateMap.set(this, {
            buttons: settings.buttons,
            settings
        });
    }

    addButton(button) {
        let buttons = _(this).buttons || [];
        buttons.push(button);
        _(this).buttons = buttons;
    }

    setButtons(buttons) {
        _(this).buttons = buttons
    }

    create(dlgOptions={}) {
        let options = {
            autoOpen: false,
            appendTo: App.$container,
            resizable: false
        };

        options = Object.assign(options, dlgOptions);

        let { settings, buttons } = {..._(this)};
        const { width, maxWidth, minWidth, minHeight, title } = { ...settings };
        options.width = width;
        options.maxWidth = maxWidth;
        options.minWidth = minWidth;
        options.minHeight = minHeight;
        if (title) options.title = title;

        if(!buttons) {
            buttons = [ Dialog.acceptButton() ];
        }

        options.buttons = buttons.slice(0);

        if (!(settings.centerOnContent === false)) {
            options.position = {
                my: 'center center',
                at: 'center center',
                of: App.ui.$content.parent()
            };
        }
        this.$dlg = $(this.host).dialog(options);
        $(window).on("resize", this.onWindowResize.bind(this));
        this.clickDefaultOnEnter();
    }

    clickDefaultOnEnter() {
        this.$dlg.keydown(function (event) {
            if (event.keyCode == $.ui.keyCode.ENTER) {
                $(this).parent().find("[data-default]").trigger("click");
                return false;
            }
        });
    }

    showModal() {
        if (!this.$dlg) {
            this.create();
        }
        this.$dlg.dialog('option', {
            'modal': true
        }).dialog('open');
    }

    close(destroy) {
        if (!this.$dlg) return;
        this.$dlg.dialog(destroy?'destroy':'close');
        if (destroy) {
            this.orphan && this.$dlg.remove();
            this.$dlg = null;
        }
    }

    onWindowResize() {

        if (this.isFull) {
            this.toggleFullMode(true);
        }
        var allDialogObjStr = sessionStorage.dfmObj;
        if (allDialogObjStr !== undefined) {
            var allDialogObj = JSON.parse(allDialogObjStr);
            allDialogObj.forEach(function (itm) {
                if (itm.isFull == "1") {
                    var itmID = itm.index;
                    var dialogWin = $(".dialog-full-mode[dfm-id=" + itmID + "]");
                    var contentWin = dialogWin.children(".ui-dialog-content");
                    var titleBar = dialogWin.children(".ui-dialog-titlebar");

                    var scrollW = self.getScrollBarWidth()
                    var winWidth = $(window).width() - scrollW / 2;
                    var winHeight = $(window).height() - scrollW / 2;

                    dialogWin.width(winWidth);
                    dialogWin.height(winHeight);

                    $(contentWin).width(winWidth - 2 * scrollW);
                    $(contentWin).height(winHeight - $(titleBar).outerHeight() - 2 * scrollW);
                }
            })
        }
    }

    toggleFullMode(fullMode) {
        const self = this;
        const dlg = self.$dlg;
        const $dialogWin = dlg.parent();//.parent();
        const titleBar = $dialogWin.children(".ui-dialog-titlebar");
        const $contentWin = $dialogWin.children(".ui-dialog-content");//.children(".ui-dialog-titlebar").next()

        const scrollW = self.getScrollBarWidth();
        const $ref = App.ui.$content.parent();
        const winWidth = $ref.width() - scrollW / 2;
        const winHeight = $ref.height() - scrollW / 2;
        const position = $ref.position();

        if (fullMode !== undefined) { //if a state is passed the, invert the state so the passed state will keep
            dlg.isFull = !fullMode;
        }

        if (dlg.isFull) {
            dlg.isFull = false;

            //return to ordinal state
            //$dialogWin.css("top", dialogObj.top);
            //$dialogWin.css("left", dialogObj.left);
            //$dialogWin.width(dialogObj.width);
            //$dialogWin.height(dialogObj.height);

            //$contentWin.width(dialogObj.contentWidth)
            //$contentWin.height(dialogObj.contentHeight);

            ////enable drag and resize
            //$(".dialog-full-mode").resizable('enable');
            //$(".dialog-full-mode").draggable('enable');

            ////
            //$(".fullscreen-btn").attr("title", "full mode");

        } else {
            dlg.isFull = true;

            //save original state
            //dialogObj.top = $dialogWin.css("top");
            //dialogObj.left = $dialogWin.css("left");
            //dialogObj.width = $dialogWin.width();
            //dialogObj.height = $dialogWin.height();

            //dialogObj.contentWidth = $contentWin.width();
            //dialogObj.contentHeight = $contentWin.height();

            //set full screen state
            $dialogWin.css("top", position.top + 35); //
            $dialogWin.css("left", position.left);

            $dialogWin.width(winWidth+1);
            $dialogWin.height(winHeight+1);
            //$(contentWin).css("height", "85%");

            //$contentWin.width(winWidth - 2 * scrollW);
            $contentWin.height(winHeight - $(titleBar).outerHeight() - 2 - 20 - 56); //55 = 35 Header + 20 Footer

            //disable drag and resize-
            //this.$dlg.resizable('disable');
            //this.$dlg.draggable('disable');
            //$(".dialog-full-mode").resizable('disable');
            //$(".dialog-full-mode").draggable('disable');

            //
            //$(".fullscreen-btn").attr("title", "exit full mode");
        }
    }

    setDimensionPosition(obj) {
        /*const dfmId = Number($(obj).attr("dfm-id"));
        const dfmAry = JSON.parse(sessionStorage.dfmObj);
        const dialogObj = dfmAry[dfmId];

        dialogObj.top = $(obj).css("top");
        dialogObj.left = $(obj).css("left");
        dialogObj.width = $(obj).width();
        dialogObj.height = $(obj).height();
        dfmAry[dfmId] = dialogObj;
        sessionStorage.dfmObj = JSON.stringify(dfmAry);*/
    }

    getScrollBarWidth() {
        var $outer = $('<div>').css({ visibility: 'hidden', width: 100, overflow: 'scroll' }).appendTo('body'),
            widthWithScroll = $('<div>').css({ width: '100%' }).appendTo($outer).outerWidth();
        $outer.remove();
        return 100 - widthWithScroll;
    };

/*
        //firefox,edge,ie11
        $('.dialog-full-mode').on('click', '.ui-button-fullscreen', function () {
            var dialogWin = $(this).parent().parent();//.parent();
            var titleBar = $(dialogWin).children(".ui-dialog-titlebar");
            var contentWin = $(dialogWin).children(".ui-dialog-content");//.children(".ui-dialog-titlebar").next()

            var dfmId = Number($(dialogWin).attr("dfm-id"));
            var dfmAry = JSON.parse(sessionStorage.dfmObj);
            var dialogObj = dfmAry[dfmId];

            var scrollW = self.getScrollBarWidth()
            var winWidth = $(window).width() - scrollW / 2;
            var winHeight = $(window).height() - scrollW / 2;

            if (dialogObj.isFull == "1") {
                dialogObj.isFull = "0";

                //return to ordinal state
                $(dialogWin).css("top", dialogObj.top);
                $(dialogWin).css("left", dialogObj.left);
                $(dialogWin).width(dialogObj.width);
                $(dialogWin).height(dialogObj.height);

                $(contentWin).width(dialogObj.contentWidth)
                $(contentWin).height(dialogObj.contentHeight);

                dfmAry[dfmId] = dialogObj;
                sessionStorage.dfmObj = JSON.stringify(dfmAry);

                //enable drag and resize
                $(".dialog-full-mode").resizable('enable');
                $(".dialog-full-mode").draggable('enable');

                //
                $(".fullscreen-btn").attr("title", "full mode");
            } else {
                dialogObj.isFull = "1";

                //save original state
                dialogObj.top = $(dialogWin).css("top");
                dialogObj.left = $(dialogWin).css("left");
                dialogObj.width = $(dialogWin).width();
                dialogObj.height = $(dialogWin).height();

                dialogObj.contentWidth = $(contentWin).width();
                dialogObj.contentHeight = $(contentWin).height();

                dfmAry[dfmId] = dialogObj;
                sessionStorage.dfmObj = JSON.stringify(dfmAry);

                //set full screen state
                $(dialogWin).css("top", 0);
                $(dialogWin).css("left", 0);

                $(dialogWin).width(winWidth);
                $(dialogWin).height(winHeight);
                //$(contentWin).css("height", "85%");

                $(contentWin).width(winWidth - 2 * scrollW);
                $(contentWin).height(winHeight - $(titleBar).outerHeight() - 2 * scrollW);

                //disable drag and resize-
                $(".dialog-full-mode").resizable('disable');
                $(".dialog-full-mode").draggable('disable');

                //
                $(".fullscreen-btn").attr("title", "exit full mode");
            }
        });

        self.setDimensionPosition = function (obj) {

            var dfmId = Number($(obj).attr("dfm-id"));
            var dfmAry = JSON.parse(sessionStorage.dfmObj);
            var dialogObj = dfmAry[dfmId];


            dialogObj.top = $(obj).css("top");
            dialogObj.left = $(obj).css("left");
            dialogObj.width = $(obj).width();
            dialogObj.height = $(obj).height();
            dfmAry[dfmId] = dialogObj;
            sessionStorage.dfmObj = JSON.stringify(dfmAry);
        }
        self.getScrollBarWidth = function () {
            var $outer = $('<div>').css({ visibility: 'hidden', width: 100, overflow: 'scroll' }).appendTo('body'),
                widthWithScroll = $('<div>').css({ width: '100%' }).appendTo($outer).outerWidth();
            $outer.remove();
            return 100 - widthWithScroll;
        };

        $(window).on("resize", function () {
            var allDialogObjStr = sessionStorage.dfmObj;
            if (allDialogObjStr !== undefined) {
                var allDialogObj = JSON.parse(allDialogObjStr);
                allDialogObj.forEach(function (itm) {
                    if (itm.isFull == "1") {
                        var itmID = itm.index;
                        var dialogWin = $(".dialog-full-mode[dfm-id=" + itmID + "]");
                        var contentWin = dialogWin.children(".ui-dialog-content");
                        var titleBar = dialogWin.children(".ui-dialog-titlebar");

                        var scrollW = self.getScrollBarWidth()
                        var winWidth = $(window).width() - scrollW / 2;
                        var winHeight = $(window).height() - scrollW / 2;

                        dialogWin.width(winWidth);
                        dialogWin.height(winHeight);

                        $(contentWin).width(winWidth - 2 * scrollW);
                        $(contentWin).height(winHeight - $(titleBar).outerHeight() - 2 * scrollW);

                        //console.log(dialogWin)
                    }
                })
            }
        })


    fullMode
*/
    static confirm(question, title) {
        return new Promise((resolve, reject) => {
            const dlg = new Dialog({
                title: title,
                buttons: [
                    {
                        text: App.i18n.t('general.yes'),
                        click: () => {
                            dlg.close(true);
                            resolve(true);
                        }
                    },
                    Dialog.closeButton(() => {
                        dlg.close(true);
                        resolve(false)
                    })
                ]
            });
            $(dlg.host).html('<p>'+question+'</p>');
            dlg.showModal();
        });
    }

    static message(msg, title) {
        return new Promise((resolve, reject) => {
            const dlg = new Dialog({
                title: title,
                buttons: [this.acceptButton(() => {
                    resolve();
                    dlg.close(true);
                })]
            });
            $(dlg.host).html('<p>'+msg+'</p>');
            dlg.showModal();
        });
    }

    static acceptButton(callback=null) {
        return {text: App.i18n.t('commands.accept'), click: callback || this.close.bind(this, true), 'data-default': true };
    }

    static closeButton(callback=null) {
        return {text: App.i18n.t('commands.cancel'), click: callback || this.close.bind(this, true)};
    }
}