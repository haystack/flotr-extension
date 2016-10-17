/**
 * @fileOverview
 * @author <a href="mailto:cdenise@mit.edu">Denise Che</a>
 * @author <a href="mailto:karger@mit.edu">David Karger</a>
 * @Library in use : Flotr2
 */

/**==================================================
 *  Exhibit.PieChartView
 *  Creates a pie chart.  Supports grouping of smaller slices to improve readability.
 *==================================================
 */

Exhibit.PieChartView = function(containerElmt, uiContext) {
    var view = this;
    Exhibit.jQuery.extend(this, new Exhibit.View("pieChart", containerElmt, uiContext));

    this.addSettingSpecs(Exhibit.PieChartView._settingSpecs);

    this._accessors = {
        getProxy : function(itemID, database, visitor) {
            visitor(itemID);
        },
    };



    this._onItemsChanged = function() {
        view._reconstruct();
    };

    Exhibit.jQuery(uiContext.getCollection().getElement()).bind("onItemsChanged.exhibit", view._onItemsChanged);

    this.register();
};

Exhibit.PieChartView._settingSpecs = {
    "plotHeight"        : {type : "int",     defaultValue : 400,    required : false, description : "height of plot in pixels", importance: 2},
    "plotWidth"         : {type : "int",    required: false, description : "width of plot in pixels", importance: 2},
    "explode"           : {type : "int",     defaultValue : 6,  required: false, description : "level of separation between slices", importance: 4},
    "group"             : {type : "boolean", defaultValue : false, required: false, description: "grouping of items below cutoff", importance:5},
    "cutoff"            : {type : "float",   defaultValue : 0.01, required: false, description: "decimal percentile; items with a value below this cutoff (decimal * sum of values) are grouped into one slice", importance:5}
};

Exhibit.PieChartView._accessorSpecs = [{
    accessorName : "getProxy",
    attributeName : "proxy",
    importance: 1
}, {
    accessorName : "getXY",
    alternatives : [{
        bindings : [{
            attributeName : "axisData",
            types : ["float", "text"],
            bindingNames : ["values", "labels"]
        }]
    }, {
        bindings : [{
            attributeName : "values",
            type : "float",
            bindingName : "x"
        }, {
            attributeName : "labels",
            type : "text",
            bindingName : "y"
        }]
    }],
    required: true,
    description: "values: property to plot\ngroupedBy: property used to label each item",
    importance: 10
}];

Exhibit.PieChartView.create = function(configuration, containerElmt, uiContext) {
    var view = new Exhibit.PieChartView(containerElmt, Exhibit.UIContext.create(configuration, uiContext));
    Exhibit.PieChartView._configure(view, configuration);

    view._initializeUI();
    return view;
};

Exhibit.PieChartView.createFromDOM = function(configElmt, containerElmt, uiContext) {
    var configuration = Exhibit.getConfigurationFromDOM(configElmt);
    var view = new Exhibit.PieChartView(containerElmt != null ? containerElmt : configElmt, Exhibit.UIContext.createFromDOM(configElmt, uiContext));
    Exhibit.SettingsUtilities.createAccessorsFromDOM(configElmt, Exhibit.PieChartView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettingsFromDOM(configElmt, view.getSettingSpecs(), view._settings);
    Exhibit.PieChartView._configure(view, configuration);

    view._initializeUI();
    return view;
};

Exhibit.PieChartView._configure = function(view, configuration) {
    Exhibit.SettingsUtilities.createAccessors(configuration, Exhibit.PieChartView._accessorSpecs, view._accessors);
    Exhibit.SettingsUtilities.collectSettings(configuration, view.getSettingSpecs(), view._settings);


    var accessors = view._accessors;

    //itemID is an item in _uiContext.getCollection().getRestrictedItems()'s _hash, for example.
    //database comes from _uiContext.getDatabase()
    //visitor is a function that takes one argument. In this case it will be:
    // function(xy) { if ("x" in xy && "y" in xy) xys.push(xy); }

    view._getXY = function(itemID, database, visitor) {
        accessors.getProxy(itemID, database, function(proxy) {
            accessors.getXY(proxy, database, visitor);
        });
    };
};

Exhibit.PieChartView.evaluateSingle = function(expression, itemID, database) {
    return expression.evaluateSingleOnItem(itemID, database).value;
}

Exhibit.PieChartView.prototype.dispose = function() {
    Exhibit.jQuery(this.getUIContext().getCollection().getElement()).unbind("onItemsChanged.exhibit", this._onItemsChanged);

    this._dom.dispose();
    this._dom = null;

    this._dispose();
};

Exhibit.PieChartView.prototype._initializeUI = function() {
    var self = this;
    var legendWidgetSettings = {};

    this._dom = Exhibit.ViewUtilities.constructPlottingViewDom(this.getContainer(), this.getUIContext(), true, // showSummary
    {
        onResize : function() {
            self._reconstruct();
        }
    }, legendWidgetSettings);
    this._dom.plotContainer.className = "exhibit-pieChartView-plotContainer";
    this._dom.plotContainer.style.height = this._settings.plotHeight + "px";
    if (this._settings.plotWidth){
        this._dom.plotContainer.style.width = this._settings.plotWidth + "px";
    }  
    this._reconstruct();
};

Exhibit.PieChartView.prototype._reconstruct = function() {
    var self, collection, container, database, settings, flotrData, unplottableItems, accessors, scaleX, unscaleX, currentSize, xyDataPub;
    self = this;
    collection = this.getUIContext().getCollection();
    database = this.getUIContext().getDatabase();
    settings = this._settings;
    accessors = this._accessors;
    this._dom.plotContainer.innerHTML = "";

    currentSize = collection.countRestrictedItems();
    xyDataPub = [];
    flotrData = [];
    unplottableItems = [];
    this._dom.legendWidget.clear();
    prepareData = function() {
        var index, currentSet, sum = 0, groupValue = 0, groupLabel = [];
        currentSet = collection.getRestrictedItems();
        
        /*
        *  Iterate through all items to find sum
        */
        if (settings.group){
            currentSet.visit(function(itemID) {
                var xys;
                xys = [];
                self._getXY(itemID, database, function(axisData) {
                    if ("x" in axisData && "y" in axisData){
                            xys.push(axisData);
                    }
                        
                });
                if (xys.length > 0){
                    xy = xys[0];
                    sum = sum + xy.x;
                } 
            });
        }
        
        /*
         *  Iterate through all items to generate flotr data
         */
        currentSet.visit(function(itemID) {
            var xys, xy, xyData;
            xys = [];
            
            self._getXY(itemID, database, function(axisData) {
                if ("x" in axisData && "y" in axisData){
                        xys.push(axisData);
                }
                    
            });

            if (xys.length > 0) {
                xy = xys[0];
                xyData = {
                    xy : xy,
                    items : [itemID]
                };
            } else {
                unplottableItems.push(itemID);
            }
            if ( typeof xyData == "object") {
                    if (settings.group && xyData.xy.x < (sum * settings.cutoff)){
                        groupValue = groupValue + xyData.xy.x;
                        groupLabel.push(xyData.xy.y + ' ');
                    } else {
                        flotrData.push({
                            data : [[0, xyData.xy.x]],
                            label: xyData.xy.y
                        });
                    }
                
                xyDataPub.push(xyData);
            }
        });
        
        // add grouped values to flotrData
        if (settings.group && groupLabel.length > 0){
            flotrData.push({
                data : [[0, groupValue]],
                label: 'Others'
            });
        }
        
    }
    
    if (currentSize > 0){
        prepareData();
        container = document.createElement("div");
        container.className = "pieChartViewContainer";
        container.style.height = "100%";
        this._dom.plotContainer.appendChild(container);
        this._flotrConstructor(xyDataPub, flotrData, container, currentSize);
    }
    
    this._dom.setUnplottableMessage(currentSize, unplottableItems);
};

Exhibit.PieChartView.prototype._flotrConstructor = function(xyDataPub, flotrData, container,  currentSize) {
    var self, settings, explode;
    self = this;
    settings = this._settings;
    explode = settings.explode;
          
            Flotr.draw(container, flotrData, {
                HtmlText : false,
                    grid : {
                        verticalLines : false,
                        horizontalLines : false
                    },
                    xaxis : { showLabels : false },
                    yaxis : { showLabels : false },
                    pie : {
                        show : true, 
                        explode : explode
                    },
                    mouse : { track : true },
                    legend : {
                        position : 'se',
                        backgroundColor : '#D2E8FF'
                    }
            });
};
