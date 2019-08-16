Table: {
    contents: [],
    page: 0, //current page number, starting at 0
    maxPages: -1,
    perPage: 25,
    columnOrder: [],
    widget: undefined,
    container: $("#leads_list"),
    sort: "",
    sortProp: "",
    data: {
        _rowsSelected: [], //contains a list of IDs representing all of the rows that are currently selected
        _contents: [], //list of objects currently displayed by the table
        _columnOrder: undefined, //list representing the order of the columns of the table
        _selectAll: false, //whether or not all of the items in the table (including those on other pages) are selected
    },
    validation: {
        cell: undefined,
        valid: false,
        maxAttempts: 2,
    },
    permission: {//this contains all of the relevant permission information for the table
        applied: false,
        level: -1,
        NONE: 0,
        VIEW: 1,
        EDIT: 2,
    },
    templates: {},
    init: function () {
        //table initialization
        //gets all the containers/elements, sets up data structures, getters/setters, and first render
        let self = Leads.UI.Widgets.options.list.Table;
        self.container = $("#leads_list");
        self.widget = $(".widget#leads_list");

        self.data._contents = Leads.UI.Resource.currentItems;
        let user = Master.Storage.currentUser();
        if (user)
            self.permission.level = user.permission.base ? 2 : (user.permission.leads == "" ? 0 : parseInt(user.permission.leads));
        //getters, setters - mainly for automatic dom updating and whatnot
        Object.defineProperty(self.data, "rowsSelected", {
            set: function (rows) {
                self.container.find("#bulk_edit_lead_header .number-selected").text(rows.length > 1 ? rows.length + " " + LeadTrackingTranslation.dbRes("leads_LeadsSelected") + "." : rows.length + " " + LeadTrackingTranslation.dbRes("leads_LeadSelected") + ".");
                self.container.find("#bulk_edit_lead_header .select-all-option").text(LeadTrackingTranslation.dbRes("leads_SelectAll") + " " + self.contents.length);
                if (rows.length > 0) {
                    self.container.find("#bulk_edit_lead_header").addClass("multi-active");
                    if (rows.length > 1) {
                        $("#lead_options_dropdown").find(".single-only").addClass("hide");
                    } else $("#lead_options_dropdown").find(".single-only").removeClass("hide");

                } else {
                    self.container.find("#bulk_edit_lead_header").removeClass("multi-active");
                    self.container.find("[data-multi-all] input").prop("checked", false).prop("indeterminate", false);
                    $("#lead_options_dropdown").find(".single-only").removeClass("hide");
                }
                this._rowsSelected = rows;
            },
            get: function () {
                return this._rowsSelected;
            }
        });
        Object.defineProperty(self, "contents", {
            set: function (contents) {
                self.data._contents = contents;
                Leads.UI.Widgets.options.stats.filterActive(!Leads.UI.Filter.isDefault());
                Leads.UI.eventFunctions.updateStageCount();
                self.render();
            },
            get: function () { return self.data._contents }
        });
        Object.defineProperty(self, "columnOrder", {
            set: function (co) {
                self.data._columnOrder = co;
                self.reorderColumns(true);
            },
            get: function () { return self.data._columnOrder ? self.data._columnOrder : Leads.columnOrder },
        });
        Object.defineProperty(self, "selectAll", {
            set: function (val) {
                if (typeof val == "boolean" && val) {
                    self.container.find("#bulk_edit_lead_header .number-selected").text(self.contents.length + LeadTrackingTranslation.dbRes("leads_LeadsSelected") + ".");
                    self.container.find("#bulk_edit_lead_header .select-all-option").hide();
                    self.container.find(".leadRow[data-multi-selectable='true']").attr("data-multi-selected", true).find("input").prop("checked", true);
                    self.container.find('#bulk_edit_lead_header .checkbox_square input').prop("indeterminate", false).prop("checked", true);

                    self.data._selectAll = true;
                }
                else if (typeof val == "boolean" && !val) {
                    self.container.find("#bulk_edit_lead_header .select-all-option").show();
                    self.data._selectAll = false;
                }
                else {
                    console.log("_selectAll not being set to a boolean");
                }
            },
            get: function () { return self.data._selectAll; }
        });
        Object.defineProperty(self.util, "propertyMap", {
            writable: false,
            value: self.util._propertyMap,
        });

        Leads.UI.Resource.setupPagination(self.widget, function (resource) {
            self.page = resource.page - 1;
            self.perPage = resource.pagination_size;
            self.render();
        });
        self.perPage = Leads.UI.Resource.pagination_size;
        self.container.find(".pagination-container .items-select").val(self.perPage);


        self.data._columnOrder = Leads.columnOrder
        //let [header, row] = Leads.UI.reorderColumns();
        //throw in the header
        self.reorderColumns();
        self.container.find(".lead-header").html(self.templates.header);
        self.data._contents = Leads.UI.Resource.filter();
        self.render();
        self.container.find(".table-contents").attr("data-viewmode", self.permission.level == self.permission.EDIT ? "EDIT" : "VIEW");
    },
    bind: function () {
        //bind all table-specific functionality - sort, inline data changing, dropdown, double click edit, multiselect, pagination, scroll
        let self = Leads.UI.Widgets.options.list.Table;
        let widget = self.widget;
        
        let header = self.container.find(".lead-header-container");
        let container = self.container.find(".lead-table-container");

        //-- HEADER BUTTONS --//
        const headerButtonActions = {
            bulkEdit: function () {
                let ids;
                if (self.selectAll) {
                    ids = _.pluck(self.contents, "id");
                }
                else {
                    ids = _.map(self.data.rowsSelected, function (r) {
                        return parseInt(r);
                    });
                }
                Leads.UI.Modals.bulkEdit(ids);
                //update data structure
                //re-render the table
                //select back the edited leads, but defer the selection
            },
            bulkDelete: function () {
                let ids;
                if (self.selectAll) {
                    ids = _.pluck(self.data._contents, "id");
                }
                else {
                    ids = _.map(self.data.rowsSelected, function (r) {
                        return parseInt(r);
                    });
                }
                if (ids.length > 1)
                    Leads.UI.Modals.bulkDelete(ids);
                else
                    Leads.UI.Modals.singleDelete(ids);
                //update data structure
                //self.contents = _.reject(self.contents, function (item) {
                //    return ids.includes(item.id);
                //});
                //adjust pages/pagination based on new length of contents
            },
            selectAll: function () {
                self.selectAll = true;
            }
        }


        header.find(".alt-button").off("mousedown").on("mousedown", function (e) {
            e.stopPropagation();
        }).off("click").on("click", function (e) {
            let action = $(this).data("btn-action");
            headerButtonActions[action]();
        });
        //-- SORT --//
        header.find(".lead-column.sort-head").off("click").on("click", function (e) {
            let $el = $(this);
            let sortName = $el.data("sort-name");
            let sortDir = $el.attr("data-sort");
            header.find(".lead-column").removeAttr("data-sort");
            if (sortDir == "asc") {
                sortDir = "desc";
            } else if (sortDir == "desc") {
                sortDir = ""
            } else {
                sortDir = "asc";
            }
            $el.attr("data-sort", sortDir);
            self.sort = sortDir;
            self.sortProp = sortName;
            self.render();
        });
        //-- INLINE EDIT --//
        //router for different cell types
        const validateCell = function ($cell) {
            if ($cell.is("input"))
                return editInput($cell);
            else if ($cell.is("select")) {
                $cell.attr("data-valid", true);
                return true;
            }
            else
                console.error("Cell Validation: attempting to validate unrecognized cell type.");
        }
        //edit a text input
        const editInput = function (cell) {
            const maxAttempts = 2;
            let self = Leads.UI.Widgets.options.list.Table;
            let parent = cell.parent();
            let dataType = parent.data("type") || "any";
            let itemID = parent.parent().data("id");
            let key = parent.data("property");
            let newValue = cell.val().trim();
            let oldValue = cell.attr("data-origcontent");
            let attempts = parseInt(cell.attr("data-attempts")) || 0;
            cell.removeAttr("data-origcontent"); //we can remove this since we already have it here (#oldValue)
            cell.removeAttr("data-attempted");
            let item = self.contents.find(item => item.id == itemID);
            if (!item) return false;

            let valid = false;

            //valid data types: any, email, phone, money, number, date
            //validation
            switch (dataType) {
                case "any": //restriction - field is not empty
                    valid = true;
                    cell.val(newValue);
                    break;
                case "name":
                    valid = newValue != "";
                    if (!valid) {
                        switch (key) {
                            case "name":
                                Materialize.toast(LeadTrackingTranslation.dbRes("leads_ValidDisplayName"), 5000);
                                break;
                            case "lname":
                                Materialize.toast(LeadTrackingTranslation.dbRes("leads_ValidLastName"), 5000);
                                break;
                            case "fname":
                                Materialize.toast(LeadTrackingTranslation.dbRes("leads_ValidFirstName"), 5000);
                                break;
                            default:
                                Materialize.toast(LeadTrackingTranslation.dbRes("leads_ValidDISPLAY_NAME"), 5000);
                        }                                        
                        cell.val(oldValue);
                    }
                    else cell.val(newValue);
                    break;
                case "email": //restriction - content passes the Util email validation text
                    valid = Util.validation.email.test(newValue)
                    if (!valid) {
                        Materialize.toast(LeadTrackingTranslation.dbRes("leads_ValidEmailRequired"), 5000);
                        //cell.val(oldValue);
                    }
                    else {
                        cell.val(newValue);
                    }
                    break;
                case "phone": //restriction - none, weird cases handled by the formatPhoneNumberUS util function. just need to reformat here
                    newValue = Util.formatPhoneNumberUS(newValue, true);
                    valid = true;
                    cell.val(newValue);
                    break;
                case "money": //restriction - none, just need to reformat (if possible - if not possible, default back to 0)
                    let numericalValue = Util.getFloatFromDollarString(newValue, s.getCountryCurrency()).toFixed(2);
                    numericalValue = isNaN(numericalValue) ? 0 : numericalValue;
                    cell.attr("data-rawvalue", numericalValue);
                    var currency = International.Countries.byID[s.getCountrySetting()].currencyID;
                    newValue = Util.getDollarString(numericalValue, currency, false, 2);
                    valid = true; //this validates by default, since if the input is NaN it just falls back to 0
                    cell.val(newValue);
                    //newValue = numericalValue
                    break;
                case "number":
                    if (isNaN(newValue)) {
                        valid = false;
                        newValue = oldValue
                    }
                    else {
                        valid = true;
                        newValue = parseFloat(newValue);
                    }
                    cell.val(newValue);
                    break;
                case "date":
                    break;
                default:
                    valid = true;
            }
            if (!valid) {
                attempts++;
                cell.attr("data-attempts", attempts);
                cell.attr("data-origcontent", oldValue);
                cell.attr("data-valid", false);
                return false;
            }
            else {
                cell.attr("data-valid", true);
                return true;
            }
        }
        //change a select
        const editSelect = function (cell) {
            let self = Leads.UI.Widgets.options.list.Table;
            let parent = cell.parent();
            let defaultValue = parent.data("default-value");
            let itemID = parent.data("id");
            let key = parent.data("property");
            let newValue = cell.val();
            let oldValue = cell.attr("data-origcontent");
            cell.removeAttr("data-origcontent");
            let item = self.contents.find(item => item.id == itemID);
            if (!item) return false;

            if (defaultValue && newValue == defaultValue) {
                newValue = "";
                cell.val(undefined);
            }
            else {
                //item[key] = parseInt(newValue);
            }
            cell.removeAttr("data-origcontent");
        }
        const saveCell = function (cell) {
            let item = self.contents.find(item => item.id == cell.parent().data("id"));
            let key = cell.parent().data("property");
            let value = cell.is("input") ? (cell.attr("data-rawvalue") || cell.val().trim()) : cell.val();
            if (!isNaN(value)) value = parseFloat(value);

            if (item && key && item.hasOwnProperty(key) && (value || value == "0") && item[key] != value) {
                item[key] = value;
                let submitString = "action=LEADS_updateLead&id=" + item.id + "&" + _.invert(self.util._propertyMap)[key] + "=" + encodeURIComponent(value);
                Util.ajaxPostNM(submitString, function (data) {
                    if (!data.SUCCESS) {
                        console.log("error in inline edit submit");
                        cell.val(oldValue);
                    }
                });
                cell.removeAttr("data-attempts").removeAttr("data-origcontent");
                return true;
            }
            else return false
        }

        container.find(".editable > select").on("focus", function () {
            //keep track of the original value so that we dont have to submit if not necessary, and to do fallback if validation fails
            $(this).attr("data-origcontent", $(this).val());
            $(this).parents(".leadRow").addClass("highlight");
        }).on("change", function () {
            editSelect($(this));
            let valid = validateCell($(this));
            if (valid) {
                $(this).removeAttr("data-attempts");
                saveCell($(this));
            }
        }).on("contextmenu", function () {
            $(this).blur();
        }).on("blur", function () {
            container.find(".highlight").removeClass("highlight");
            $(this).attr("data-valid", true);
        });

        container.find(".leadRow .editable.dropdown > select").each(function () {
            let cell = $(this);
            let itemID = cell.parent().data("id");
            let prop = cell.parent().data("property");
            let value = Leads.UI.Resource.getSingle(itemID)[prop];
            cell.val(typeof value == "object" ? value.id : value);
        });
        container.find(".leadRow .editable.dropdown > select > option[data-hiddenoption='true']").hide();
        container.find(".leadRow .editable > input").on("focus", function () {
            if (!$(this).attr("data-origcontent")) {
                $(this).attr("data-origcontent", $(this).val().trim());
            }
            container.find(".highlight").removeClass("highlight");
            $(this).parents(".leadRow").addClass("highlight");
        }).on("blur", function () {
            container.find(".highlight").removeClass("highlight");
            //this next bit handles the behavior for when the user tries to use an invalid input
            let valid = validateCell($(this));
            if (!valid && parseInt($(this).attr("data-attempts")) < self.validation.maxAttempts) {
                let $el = $(this);
                setTimeout(function () {
                    $el.focus();
                    $el.select();
                }, 0);
            }
            else if (!valid && parseInt($(this).attr("data-attempts")) >= self.validation.maxAttempts) {
                $(this).removeAttr("data-attempts");
                let value = $(this).attr("data-origcontent");
                $(this).removeAttr("data-origcontent");
                $(this).val(value);
            }
            else if (valid) {
                let $el = $(this);
                _.defer(function () { $el.removeAttr("data-attempts").removeAttr("data-valid") });
                saveCell($el);
                $(this).removeAttr("value");
            }
        }).on("contextmenu", function (e) {
            //prevents confusion when right clicking on an editable cell
            $(this).blur();
        });
        //-- KEYBOARD NAVIGATION --//
        container.find(".leadRow .editable:not(.no-tab) > *").on("keydown", function (e) {                      
            if (e.which == 9 || e.which == 13) { //9 = tab, 13 = enter
                e.preventDefault();
                const findNextCell = function ($cell, event) {
                    let step = Leads.UI.Widgets.elements.list.container.find(".leadRow:first .editable:not(.no-tab)").length; //determine how many editable inputs/selects there are per row
                    let allCells = Leads.UI.Widgets.elements.list.container.find(".leadRow .editable:not(.no-tab) > *");
                    let currIndex = allCells.index($cell);
                    let shift = event.shiftKey;
                    let nextIndex = -1;
                    if (event.which == 9) { //tab
                        nextIndex = currIndex + (shift ? -1 : 1);
                    }
                    else if (event.which == 13) { //enter
                        nextIndex = currIndex + (shift ? -step : step);
                    }
                    //check to see if the index is outside of the range of the cells
                    if (nextIndex < 0 || nextIndex > allCells.length - 1) {
                        return $cell;
                    }
                    else {
                        //if its not return the cell at the next index
                        return allCells.eq(nextIndex);
                    }
                }
                let nextCell = findNextCell($(this), e);

                $(this).trigger("blur");
                if (Util.clean.boolean($(this).attr("data-valid"))) {
                    $(this).parents(".leadRow").removeClass("highlight");
                    nextCell.parents(".leadRow").addClass("highlight");
                    setTimeout(function () {
                        nextCell.focus();
                        $('#fixedScrollbarLeft').scrollLeft($(".lead-table-container").scrollLeft());
                    }, 10);
                }
                $(this).removeAttr("data-valid");
            }
        });
        //-- DROPDOWNS --//
        header.find(".leadHeader").dropdown();
        container.find(".leadRow").dropdown();
        container.find(".leadRow").on("contextmenu", function (e) {
            if (self.data.rowsSelected.length > 1) {
            }
            else {
                $(".leadRow").removeClass("highlight");
                $(e.currentTarget).addClass("highlight");
            }
        });
        //-- MULTISELECT --//
        container.find(".leadRow").multiSelect();
        //multiselectchanged dispatches on the widget element
        widget.off("multiselectchanged").on("multiselectchanged", function (e) {
            self.data.rowsSelected = container.find(".leadRow[data-multi-selected='true']").map(function () { return parseInt($(this).data("id")); }).get();
            _.defer(function () { self.selectAll = self.data.rowsSelected.length == self.contents.length }); //hides select all button if user manually selects all of their leads
        }).off("multiselectcleared").on("multiselectcleared", function () {
            self.data.rowsSelected = [];
            self.selectAll = false;
            container.find(".highlight").removeClass("highlight");
        });
        //this makes table ignore focusing on inline edit cells when using the multiselect functionality
        container.find(".editable > *").on("mousedown", function (e) {
            const ctrlKey = /^((?!chrome|android).)*Macintosh/i.test(navigator.userAgent) ? 'metaKey' : 'ctrlKey'
            if (e[ctrlKey] || e.shiftKey) e.preventDefault();
        });

        //-- EDIT --//
        container.find(".leadRow").on("dblclick", function () {
            Leads.UI.Modals.singleEdit($(this).data("id"));
        });

        //-- FILTER COUNTS UPDATING --//
        container.find("[data-updatefilters='true']").on("change", Leads.UI.eventFunctions.updateStageCount);

        //-- QUALITY STARS --//
        container.find(".leadRow").on("click", ".stars:not(.viewonly)", function (e) {
            let leadID = $(this).parents(".leadRow").data("id");
            let quality = $(this).index() + 1;
            let lead = Leads.UI.Resource.getSingle(leadID);
            if (lead) {
                lead.quality = quality;
                $(this).parents(".leadRow").find(".lead_quality > div").removeClass().addClass("quality-" + quality);
                Util.ajaxPostNM("action=LEADS_updateLead&id=" + leadID + "&LEAD_QUALITY=" + quality, function () { });
            }
        });

        //-- DATEPICKERS --//
        container.find(".leadRow [data-type='date'] input").each(function() {
            let input = $(this);
            input.off("blur").off("keydown");
            let val = input.val();
            let row = input.parents(".leadRow");
            let leadID = parseInt(row.attr("data-id"));
            input.colDatePicker({
                startDate: val ? moment(val, Util.getDateFormat()) : moment(),
                drops: "up",
            },(date) => {
                let lead = Leads.UI.Resource.getSingle(leadID);
                if (lead) {
                    switch (input.parent().data("property")) {
                        case "openedDate":
                            Leads.UI.eventFunctions.changeOpenedDate(lead, date);
                            break;
                        case "closedDate":
                            Leads.UI.eventFunctions.changeClosedDate(lead, date);
                            break;
                        case "lastContact":
                            Leads.UI.eventFunctions.changeLconDate(lead, date);
                            break;
                    }
                }
            });
        });


    },                    
    render: function () {
        //handles most of the work for rendering the table - paginating the data, turning it into html, binding events, and then doing post-render stuff (hiding certain columns, preselect, etc)
        //build table html based on whatever the current item list is, show

        //items = Leads.UI.Resource.currentItems; //items ? items : (Leads.UI.Widgets.options.list.Table.contents || Leads.UI.Resource.currentItems);
        let self = Leads.UI.Widgets.options.list.Table;
        let header = self.templates.header, row = self.templates.row;
        let items = self.contents;

        //get the pagination info - 0 initial index
        Leads.UI.Resource.filterLength = self.contents.length + "";
        Leads.UI.Resource.updatePages(Leads.UI.Widgets.elements.list.container, self.page + 1, function (resource) {
            self.page = resource.page - 1;
        });

        let currentPage = self.page;
        let itemsPerPage = parseInt(self.container.find(".pagination-container .items-select").val());
        let sIdx = currentPage * itemsPerPage;
        let eIdx = sIdx + itemsPerPage;

        self.data._contents = items = self.util.sort(items);
        items = items.slice(sIdx, eIdx);
        let html = _.reduce(items, function (str, p) {
            let atts = [];
            _.each(Leads.UI.Resource.files.LEAD_FILES, function (file) {
                if (file.CON_ID == p.id)
                    atts.push(file);
            });
            p.attachments = new COLObject.Attachments(atts);
            return str += Util.templateHelper(row, p);
        }, "");

        if (html == "") {
            self.container.find(".lead-rows").html("");
            EmptyView.create({
                type: "lead_filter",
                message: LeadTrackingTranslation.dbRes("leads_EmptyMessage"),
                empty_message: LeadTrackingTranslation.dbRes("leads_NoFilterResults"),
                empty_message_details: LeadTrackingTranslation.dbRes("leads_NoFilterResultsDetails"),
                appendTo: self.container.find(".lead-rows"),
            });
            $('#fixedScrollbarLeft').hide();
        }
        else {
            if (self.permission.level == self.permission.EDIT) {
                let $html = self._appendInline($(html));
                html = _.reduce($html, function (str, row) {
                    return str += row.outerHTML;
                }, ""); //this fixes the issue where jquery only gets the inner html of each item in the list (so it only gets the inner html of each .leadRow)
            }
            self.container.find(".lead-rows").html(html);
            $('#fixedScrollbarLeft').show();
        }                        
        self._hideHiddenColumns();
        self.container.find("#bulk_edit_lead_header").removeClass("multi-active");

        self.bind();
        if (self.data.rowsSelected.length > 0) {
            //preselect rows after a bulk edit or stuff like that
            _.each(self.data.rowsSelected, function (rID) {
                let row = self.container.find(".leadRow[data-id='" + rID + "']");
                row.find("[data-multi-check] input").prop("checked", true);
                row.attr("data-multi-selected", true);
            });
            self.container.find("#bulk_edit_lead_header").addClass("multi-active");
        }

        Leads.UI.eventFunctions.bindScrollEvents(self.widget);
        $('#fixedScrollbarLeft').trigger("scroll");

        if (!self.permission.applied) {
            self._applyPermission();
            self.permission.applied = true;
        }
        self.container.find(".lead-column.lead_pinned").each(function () {
            if ($(this).data("pin") != 0 && $(this).data("pin") != "undefined") $(this).addClass("redline_is_pinned");
        });
    },
    _appendInline: function ($html) {
        //appends all of the inline stuff into the main html content instead of doing it afterward - speeds up page rendering by html'ing everything in at once rather than appending it one-by-one
        //make dropdowns
        let allOptions = {};
        let allProps = Object.keys(_.groupBy($html.find(".editable.dropdown"), function (e) { return $(e).data("property") }));
        let createOptions = function (source, addDefault) {
            let inlineSelect = $("<select class='browser-default'>");
            if (addDefault) {
                let opt = $("<option value='-1'>");
                opt.text(typeof addDefault == "boolean" ? "(" + MasterPageTranslation.dbRes("settings_None") + ")" : addDefault);
                inlineSelect.append(opt);
            }
            _.each(source, function (option) {
                let opt = $("<option value='" + option.id + "'>");
                opt.text(option.text);
                if (!option.active) opt.attr("data-hiddenoption", true);
                inlineSelect.append(opt);
            });
            return inlineSelect;
        }
        _.each(allProps, function (prop) {
            let results;
            //text: the text that will show up for the option in the select
            //id: the related id of the item that will be used when inline editing
            //active: whether or not the option should be displayed in the dropdown
            //**NOTE: inactive stages/sources/types are still shown in the row of the lead, even if they are inactive/unchecked. they are just not an option for filtering or for inline editing
            if (prop == "assignedTo") {
                results = createOptions(_.map(Master.Storage.companyContactSelector, function (s, i) {
                    return { text: s.title, id: s.id, active: true, } //sales reps will always be active if they are on the contact list
                }), true);
            }
            else if (prop == "status") {
                results = createOptions(_.map(Leads.statuses, function (s, i) {
                    return { text: s, id: i, active: true, }; //statuses cannot be deactivated
                }));
            }
            else if (prop == "source") {
                results = createOptions(_.map(Leads.sources, function (s, i) {
                    return { text: s.name, id: i, active: s.active, };
                }));
            }
            else if (prop == "stage") {
                results = createOptions(_.map(Leads.stages, function (s, i) {
                    return { text: s.string, id: i, active: s.active, };
                }));
            }
            else if (prop == "type") {
                results = createOptions(_.map(Leads.types, function (s, i) {
                    return { text: s.name, id: i, active: s.active, };
                }));
            }
            allOptions[prop] = results;
        });
        for (key in allOptions) {
            $html.find(".editable.dropdown[data-property='" + key + "']").html("").append(allOptions[key]);
        }

        //inputs
        $html.find(".editable:not(.dropdown)").each(function () {
            let inlineInput = $("<input class='browser-default lead-inline-edit' />");
            let cell = $(this);
            let cellText = cell.text();
            inlineInput.val(cellText).attr("value", cellText);
            cell.html("").append(inlineInput);
        });
        return $html;
    },
    _applyPermission: function () {
        //LEAD PERMISSIONS                    
        //applies permissions, mainly just takes away adding/editing/deleting as well as some other stuff for view-only users
        //the empty view for no-view users is handled in #setupWidgets
        let self = Leads.UI.Widgets.options.list.Table;
        let container = self.container;
        let user = Master.Storage.currentUser();
        if (!user) {
            console.log("error when trying to set permissions");
            return;
        }
        const perm = self.permission;
        //no permissions view is taken care of in setupWidgets
        if (!user.permission.base && user.permission.leads == perm.VIEW) {
            //user has view permissions but cant edit anything
            $(".widget .settings").addClass("hide");
            $("#pipeline_main_container").find(".subheader, .empty-action").addClass("hide");
            $("#lead_options_dropdown").find(".lead-event, .lead-log, .albDelete").remove();
            $("#lead_options_dropdown").find("a[data-action=edit]").text(ContactsTranslation.dbRes("leads_ViewLead"));
            $("#lead_widget_dropdown").find(".options-import, .options-capture").addClass("hide");
            //$("#lead_table .leadRow, .leadHeader").find("input").prop("disabled", true);
            $(".lead-table-container .lead_quality .stars").addClass("viewonly");
            container.find(".lead-header .bulk-action-buttons").hide();
            container.find(".leadRow").multiSelect("destroy");
        }
        else if (user.permission.base || user.permission.leads == perm.EDIT) {                            

        }
        else {
            console.log("base: " + user.permission.base + " leads: " + user.permission.leads);
        }
        //QUES - should viewonly users be able to add to projects/opportunities?
        //QUES - should viewonly users be able to multiselect? but not use the bulk edit options - NO
    },
    _hideHiddenColumns: function () {
        //this function hides any columns that the current user shouldn't have access to, based on their permission
        let self = Leads.UI.Widgets.options.list.Table;
        self.container.find("[data-permissionreq]").filter(function () {
            return parseInt($(this).data("permissionreq")) > self.permission.level;
        }).hide();
    },
    util: {
        sort: function (items) {
            let self = Leads.UI.Widgets.options.list.Table;
            let prop = self.sortProp;
            let dir = self.sort;
            let asc = dir == "" || dir != "desc";
            //this is ugly, but basically it just picks the correct sorting process for the given property
            var sort;
            switch (prop) {
                case 'quality':
                case 'value': {
                    sort = function (lead) {
                        return lead[prop];
                    };
                    break;
                }
                case 'source': {
                    sort = function (lead) {
                        return Leads.sources[lead[prop]].name.toLowerCase().trim();
                    };
                    break;
                }
                case 'type': {
                    sort = function (lead) {
                        return Leads.types[lead[prop]].name.toLowerCase().trim();
                    };
                    break;
                }
                case 'stage': {
                    sort = function (lead) {
                        return Leads.stages[lead[prop]].string.toLowerCase().trim();
                    };
                    break;
                }
                case 'status': {
                    sort = function (lead) {
                        return Leads.statuses[lead[prop]].toLowerCase().trim();
                    };
                    break;
                }
                case 'openedDate':
                case 'closedDate':
                case 'lastContact':
                case 'nextCallback':
                case 'lastCallback': {
                    sort = function (lead) {
                        var date = lead[prop];//moment(lead[prop], Util.getDateFormat()).toDate();
                        return (!date ? (asc ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER) : date.getTime());
                    };
                    break;
                }
                default: {
                    prop = "name";
                    sort = function (lead) {
                        return (!(lead[prop])) ? "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" : lead[prop].trim().toLowerCase();
                    };
                    var pushback = true;
                    break;
                }
            }
            var sortedLeads = _.sortBy(items, sort);
            if (!asc) sortedLeads.reverse();                        
            return sortedLeads;
        },
        _propertyMap: {
            "FIRSTNAME": "fname",
            "LASTNAME": "lname",
            "MIDDLENAME": "mname",
            "DISPLAY_NAME": "name",
            "COMPANY": "company",
            "PHONE": "phone",
            "MOBILE_PHONE": "mobilePhone",
            "FAX": "fax",
            "LEAD_STATUS": "status",
            "LEAD_STAGE": "stage",
            "LEAD_SOURCE": "source",
            "LEAD_TYPE": "type",
            "LEAD_ASSIGNED_TO": "assignedTo",
            "LEAD_VALUE": "value",
            "EMAIL": "email",
            "LEAD_OPENED": "openedDate",
            "LEAD_CLOSED": "closedDate",
        },
    },
    reorderColumns: function (render) {
        let self = Leads.UI.Widgets.options.list.Table;
        let $rowTemplate = $(Leads.UI.Templates.lead_row_default);
        let $tableHeader = $(Leads.UI.Templates.table_header_default);
        let columnOrder = self.columnOrder;
        _.each(columnOrder, function (co) {
            co = parseInt(co);
            let tempTableItem = $rowTemplate.find('[data-col-sort="' + Math.abs(co) + '"]').detach();
            let tempHeaderItem = $tableHeader.find('[data-col-sort="' + Math.abs(co) + '"]').detach();
            if (co > 0) {
                tempHeaderItem.removeClass("hidden");
                tempTableItem.removeClass("hidden");
                $rowTemplate.append(tempTableItem);
                $tableHeader.append(tempHeaderItem);
            }
            else {
                tempHeaderItem.addClass("hidden");
                tempTableItem.addClass("hidden");
            }
        });
        Leads.UI.Resource.columnOrder = columnOrder;
        Leads.UI.Templates.lead_row = $rowTemplate[0].outerHTML;
        Leads.UI.Templates.table_header = $tableHeader[0].outerHTML;
        Leads.UI.Templates.table_header += _.reduce($(".alt_lead_header_template"), function (str, j) {
            return str += $(j).html();
        }, "");
        Leads.UI.Widgets.options.list.Table.templates = { header: Leads.UI.Templates.table_header, row: Leads.UI.Templates.lead_row };
        self.container.find(".lead-header").html(self.templates.header);
        if(render) Leads.UI.Widgets.options.list.Table.render();
    },
    dropdowns: {},
    updateDropdowns: function (dropdown) {
        let self = Leads.UI.Widgets.options.list.Table;
        let container = self.container;
        let results;
        if (dropdown == "assignedTo") {
            results = createOptions(_.map(Master.Storage.companyContactSelector, function (s, i) {
                return { text: s.title, id: s.id }
            }), true);
        }
        else if (dropdown == "status") {
            results = createOptions(_.map(Leads.statuses, function (s, i) {
                return { text: s, id: i };
            }));
        }
        else if (dropdown == "source") {
            results = createOptions(_.map(_.filter(Leads.sources, s => s.active), function (s, i) {
                return { text: s.name, id: i };
            }));
        }
        else if (dropdown == "stage") {
            results = createOptions(_.map(_.filter(Leads.stages, s => s.active), function (s, i) {
                return { text: s.string, id: i };
            }));
        }
        else if (dropdown == "type") {
            results = createOptions(_.map(_.filter(Leads.types, s => s.active), function (s, i) {
                return { text: s.name, id: i };
            }));
        }
        container.find(".leadRow .editable.dropdown[data-property='" + dropdown + "'] select").each(function () {
            let currentVal = $(this).val();
            let fallback = $(this).find("option").eq(0).attr("value");
            $(this).html("");
            _.each(results, function (res) {
                $(this).append(res);
            });
            if ($(this).find("option[value='" + currentVal + "']")) {
                $(this).val(currentVal);
            } else {
                $(this).val(fallback).change();
            }
        });
    }
}
