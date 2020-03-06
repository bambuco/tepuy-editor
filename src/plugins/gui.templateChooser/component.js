import { App } from '../../js/app';

export class GuiTemplateChooser {

    constructor() {
        App.registerHook('gui_templatechooser', this.initialize.bind(this));
        this.menu = [
        { text: 'Save', icon: 'ui-icon-disk'},
        { text: 'Zoom In', icon: 'ui-icon-zoomin'}
        ];
    }

    initialize() {
        const sidebarTpl = $.templates("script#gui-tplchooser-sidebar");
        const contentTpl = $.templates("script#gui-tplchooser-content");

        var categories = App.api.call('getTemplateCategories');
        var templates = App.api.call('getTemplates', { });

        contentTpl.link(App.ui.$content, { templates });
        sidebarTpl.link(App.ui.$sidebar, { categories }, {
            onFilter: this.onFilter.bind(this)
        });
        App.ui.$sidebar.localize();
        App.ui.$content.localize();

        App.ui.$sidebar.find('#tabs').tabs();
        this.contentTpl = contentTpl;

        var $detailName = App.ui.$content.find('#detailName');
        var $detailText = App.ui.$content.find('#detailText');
        var $detailImg =  App.ui.$content.find('#detailImg');
        var $detailDate = App.ui.$content.find('#detailDate');
        var $detailLicense = App.ui.$content.find('#detailLicense');

        $.each(templates,function (index) {
         $('#'+templates[index].id).click(function (e) {
            $detailName.text(templates[index].name);
            $detailText.text(templates[index].description);
            $detailImg.attr('src',templates[index].imagen);
            $detailDate.text(templates[index].createdBy);
            $detailLicense.text(templates[index].license);

            $( "#detailTemplate" ).dialog({
                modal: true,
                width:'60%',
               // height: '450px'
           });
        });
     });
    }

    onFilter(e) {
        e.preventDefault();
        var $keyword = App.ui.$sidebar.find('#keyword');
        var $categories = App.ui.$sidebar.find($("input[type=checkbox]:checked"));
        var templates = App.api.call('getTemplates',{keyword: $keyword.val(),categories: $categories.attr("id")});
        this.contentTpl.link(App.ui.$content, { templates });
        App.ui.$content.localize();

        var $detailName = App.ui.$content.find('#detailName');
        var $detailText = App.ui.$content.find('#detailText');
        var $detailImg =  App.ui.$content.find('#detailImg');
        var $detailDate = App.ui.$content.find('#detailDate');
        var $detailLicense = App.ui.$content.find('#detailLicense');

        $.each(templates,function (index) {
         $('#'+templates[index].id).click(function (e) {
            $detailName.text(templates[index].name);
            $detailText.text(templates[index].description);
            $detailImg.attr('src',templates[index].imagen);
            $detailDate.text(templates[index].createdBy);
            $detailLicense.text(templates[index].license);

            $( "#detailTemplate" ).dialog({
                modal: true,
                width:'60%',
            });
        });
     });



    }
}
