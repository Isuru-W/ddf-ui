/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global define, setTimeout*/
define([
    'marionette',
    'underscore',
    'jquery',
    './query-basic.hbs',
    'js/CustomElements',
    'js/store',
    'js/IconHelper',
    'component/dropdown/dropdown',
    'component/dropdown/query-src/dropdown.query-src.view',
    'component/property/property.view',
    'component/property/property',
    'js/cql',
    'component/singletons/metacard-definitions',
    'component/singletons/sources-instance',
    'js/CQLUtils',
    'component/query-settings/query-settings.view',
    'component/query-time/query-time.view',
    'js/Common'
], function (Marionette, _, $, template, CustomElements, store, IconHelper, DropdownModel,
             QuerySrcView, PropertyView, Property, cql, metacardDefinitions, sources,
            CQLUtils, QuerySettingsView, QueryTimeView, Common) {

    function isNested(filter) {
        var nested = false;
        filter.filters.forEach(function (subfilter) {
            nested = nested || subfilter.filters;
        });
        return nested;
    }

    function isTypeLimiter(filter) {
        var typesFound = {};
        filter.filters.forEach(function (subfilter) {
            typesFound[CQLUtils.getProperty(subfilter)] = true;
        });
        typesFound = Object.keys(typesFound);
        return (typesFound.length === 2) && (typesFound.indexOf('metadata-content-type') >= 0) &&
            (typesFound.indexOf('datatype') >= 0);
    }

    function isAnyDate(filter) {
        var propertiesToCheck = ['created', 'modified', 'effective', 'metacard.created', 'metacard.modified'];
        var typesFound = {};
        var valuesFound = {};
        if (filter.filters.length === propertiesToCheck.length) {
            filter.filters.forEach(function (subfilter) {
                typesFound[subfilter.type] = true;
                valuesFound[subfilter.value] = true;
                var indexOfType = propertiesToCheck.indexOf(CQLUtils.getProperty(subfilter));
                if (indexOfType >= 0) {
                    propertiesToCheck.splice(indexOfType, 1);
                }
            });
            return propertiesToCheck.length === 0 && Object.keys(typesFound).length === 1 && Object.keys(valuesFound).length === 1;
        }
        return false;
    }

    function translateFilterToBasicMap(filter) {
        var propertyValueMap = {};
        var downConversion = false;

        if (filter.filters && isAnyDate(filter)) {
            propertyValueMap['anyDate'] = propertyValueMap['anyDate'] || [];
            if (propertyValueMap['anyDate'].filter(function (existingFilter) {
                    return existingFilter.type === filter.filters[0].type;
                }).length === 0) {
                propertyValueMap['anyDate'].push(filter.filters[0]);
            }
        }

        if (filter.filters) {
            filter.filters.forEach(function (filter) {
                if (!filter.filters) {
                    propertyValueMap[CQLUtils.getProperty(filter)] = propertyValueMap[CQLUtils.getProperty(filter)] || [];
                    if (propertyValueMap[CQLUtils.getProperty(filter)].filter(function (existingFilter) {
                            return existingFilter.type === filter.type;
                        }).length === 0) {
                        propertyValueMap[CQLUtils.getProperty(filter)].push(filter);
                    }
                } else if (!isNested(filter) && isAnyDate(filter)) {
                    propertyValueMap['anyDate'] = propertyValueMap['anyDate'] || [];
                    if (propertyValueMap['anyDate'].filter(function (existingFilter) {
                            return existingFilter.type === filter.filters[0].type;
                        }).length === 0) {
                        propertyValueMap['anyDate'].push(filter.filters[0]);
                    }
                } else if (!isNested(filter) && isTypeLimiter(filter)) {
                    propertyValueMap[CQLUtils.getProperty(filter.filters[0])] = propertyValueMap[CQLUtils.getProperty(filter.filters[0])] || [];
                    filter.filters.forEach(function (subfilter) {
                        propertyValueMap[CQLUtils.getProperty(filter.filters[0])].push(subfilter);
                    });
                } else {
                    downConversion = true;
                }
            });
        } else {
            propertyValueMap[CQLUtils.getProperty(filter)] = propertyValueMap[CQLUtils.getProperty(filter)] || [];
            propertyValueMap[CQLUtils.getProperty(filter)].push(filter);
        }
        return {
            propertyValueMap: propertyValueMap,
            downConversion: downConversion
        };
    }

    return Marionette.LayoutView.extend({
        template: template,
        tagName: CustomElements.register('query-basic'),
        modelEvents: {},
        events: {
            'click .editor-edit': 'edit',
            'click .editor-cancel': 'cancel',
            'click .editor-save': 'save'
        },
        regions: {
            basicSettings: '.basic-settings',
            basicText: '.basic-text',
            basicTextMatch: '.basic-text-match',
            basicTime: '.basic-time-details',
            basicLocation: '.basic-location',
            basicLocationSpecific: '.basic-location-specific',
            basicType: '.basic-type',
            basicTypeSpecific: '.basic-type-specific'
        },
        ui: {},
        filter: undefined,
        onBeforeShow: function(){
            this.model = this.model._cloneOf ? store.getQueryById(this.model._cloneOf) : this.model;
            var translationToBasicMap = translateFilterToBasicMap(cql.simplify(cql.read(this.model.get('cql'))));
            this.filter = translationToBasicMap.propertyValueMap;
            this.handleDownConversion(translationToBasicMap.downConversion);
            this.setupSettings();
            this.setupTime();
            this.setupTextInput();
            this.setupTextMatchInput();
            
            this.setupLocation();
            this.setupLocationInput();
            this.setupType();
            this.setupTypeSpecific();
            
            this.listenTo(this.basicLocation.currentView.model, 'change:value', this.handleLocationValue);
            this.listenTo(this.basicType.currentView.model, 'change:value', this.handleTypeValue);

            this.handleLocationValue();
            this.handleTypeValue();
            this.turnOnLimitedWidth();
            this.edit();
        },
        setupSettings: function () {
            this.basicSettings.show(new QuerySettingsView({
                model: this.model
            }))
        },
        setupTime: function(){
            this.basicTime.show(new QueryTimeView({
                model: this.model,
                filter: this.filter
            }));
        },
        setupTypeSpecific: function(){
            var currentValue = [];
            if (this.filter['metadata-content-type']) {
                currentValue = _.uniq(this.filter['metadata-content-type'].map(function (subfilter) {
                    return subfilter.value;
                }));
            }
            this.basicTypeSpecific.show(new PropertyView({
                model: new Property({
                    enumFiltering: true,
                    showValidationIssues: false,
                    enumMulti: true,
                    enum: sources.toJSON().reduce(function (enumArray, source) {
                        source.contentTypes.forEach(function (contentType) {
                            if (contentType.value && (enumArray.filter(function (option) {
                                    return option.value === contentType.value;
                                }).length === 0)) {
                                enumArray.push({
                                    label: contentType.name,
                                    value: contentType.value,
                                    class: "icon " + IconHelper.getClassByName(contentType.value)
                                });
                            }
                        });
                        return enumArray;
                    }, metacardDefinitions.enums.datatype ? metacardDefinitions.enums.datatype.map(function (value) {
                        return {
                            label: value,
                            value: value,
                            class : "icon " + IconHelper.getClassByName(value)
                       };
                   }) : []),
                    value: [currentValue],
                    id: 'Types'
                })
            }));
        },
        setupType: function () {
            var currentValue = 'any';
            if (this.filter['metadata-content-type']) {
                currentValue = 'specific'
            }
            this.basicType.show(new PropertyView({
                model: new Property({
                    value: [currentValue],
                    id: 'Match Types',
                    radio: [{
                        label: 'Any',
                        value: 'any'
                    }, {
                        label: 'Specific',
                        value: 'specific'
                    }]
                })
            }));
        },
        setupLocation: function () {
            var currentValue = 'any';
            if (this.filter.anyGeo) {
                currentValue = 'specific'
            }
            this.basicLocation.show(new PropertyView({
                model: new Property({
                    value: [currentValue],
                    id: 'Located',
                    radio: [{
                        label: 'Anywhere',
                        value: 'any'
                    }, {
                        label: 'Somewhere Specific',
                        value: 'specific'
                    }]
                })
            }));
        },
        setupLocationInput: function () {
            var currentValue = '';
            if (this.filter.anyGeo) {
                currentValue = this.filter.anyGeo[0];
            }
            this.basicLocationSpecific.show(new PropertyView({
                model: new Property({
                    value: [currentValue],
                    id: 'Location',
                    type: 'LOCATION'
                })
            }));
        },
        handleTypeValue: function () {
            var type = this.basicType.currentView.model.getValue()[0];
            this.$el.toggleClass('is-type-any', type === 'any');
            this.$el.toggleClass('is-type-specific', type === 'specific');
        },
        handleLocationValue: function () {
            var location = this.basicLocation.currentView.model.getValue()[0];
            this.$el.toggleClass('is-location-any', location === 'any');
            this.$el.toggleClass('is-location-specific', location === 'specific');
        },
        setupTextMatchInput: function(){
            this.basicTextMatch.show(new PropertyView({
                model: new Property({
                    value: [this.filter.anyText && this.filter.anyText[0].type === 'LIKE' ? 'LIKE' : 'ILIKE'],
                    id: 'Match Case',
                    placeholder: 'Text to search for.  Use "*" for wildcard.',
                    radio: [{
                        label: 'Yes',
                        value: 'LIKE'
                    }, {
                        label: 'No',
                        value: 'ILIKE'
                    }]
                })
            }));
        },
        setupTextInput: function () {
            this.basicText.show(new PropertyView({
                model: new Property({
                    value: [this.filter.anyText ? this.filter.anyText[0].value : ''],
                    id: 'Text',
                    placeholder: 'Text to search for.  Use "%" or "*" for wildcard.'
                })
            }));
        },
        turnOnLimitedWidth: function () {
            this.regionManager.forEach(function (region) {
                if (region.currentView && region.currentView.turnOnLimitedWidth) {
                    region.currentView.turnOnLimitedWidth();
                }
            });
        },
        turnOffEdit: function () {
            this.regionManager.forEach(function (region) {
                if (region.currentView && region.currentView.turnOffEditing) {
                    region.currentView.turnOffEditing();
                }
            });
        },
        edit: function () {
            this.$el.addClass('is-editing');
            this.regionManager.forEach(function (region) {
                if (region.currentView && region.currentView.turnOnEditing) {
                    region.currentView.turnOnEditing();
                }
            });
            var tabable = _.filter(this.$el.find('[tabindex], input, button'), function (element) {
                return element.offsetParent !== null;
            });
            if (tabable.length > 0) {
                $(tabable[0]).focus();
            }
        },
        focus: function(){
            this.basicText.currentView.focus();
        },
        cancel: function(){
            this.$el.removeClass('is-editing');
            this.onBeforeShow();
        },
        handleDownConversion: function (downConversion) {
            this.$el.toggleClass('is-down-converted', downConversion);
        },
        save: function () {
            this.$el.removeClass('is-editing');
            this.basicSettings.currentView.saveToModel();

            var filter = this.constructFilter();
            var generatedCQL = CQLUtils.transformFilterToCQL(filter);
            this.model.set({
                cql: generatedCQL,
                isAdvanced: false
            });
        },
        constructFilter: function () {
            var filters = [];

            var text = this.basicText.currentView.model.getValue()[0];
            if (text !== "") {
                var matchCase = this.basicTextMatch.currentView.model.getValue()[0];
                filters.push(CQLUtils.generateFilter(matchCase, 'anyText', text));
            }

            this.basicTime.currentView.constructFilter().forEach((timeFilter) => {
                filters.push(timeFilter);
            });

            var locationSpecific = this.basicLocation.currentView.model.getValue()[0];
            var location = this.basicLocationSpecific.currentView.model.getValue()[0];
            var locationFilter = CQLUtils.generateFilter(undefined, 'anyGeo', location);
            if (locationSpecific === 'specific' && locationFilter) {
                filters.push(locationFilter);
            }

            var types = this.basicType.currentView.model.getValue()[0];
            var typesSpecific = this.basicTypeSpecific.currentView.model.getValue()[0];
            if (types === 'specific' && typesSpecific.length !== 0) {
                var typeFilter = {
                    type: 'OR',
                    filters: typesSpecific.map(function (specificType) {
                        return CQLUtils.generateFilter('ILIKE', 'metadata-content-type', specificType);
                    }).concat(typesSpecific.map(function (specificType) {
                        return CQLUtils.generateFilter('ILIKE', 'datatype', specificType);
                    }))
                };
                filters.push(typeFilter)
            }

            if (filters.length === 0) {
                filters.unshift(CQLUtils.generateFilter('ILIKE', 'anyText', '*'));
            }

            return {
                type: 'AND',
                filters: filters
            };
        },
        setDefaultTitle: function(){
            var text = this.basicText.currentView.model.getValue()[0];
            var title;
            if (text === "") {
                title = this.model.get('cql');
            } else {
                title = text;
            }
            this.model.set('title', title);
        }
    });
});