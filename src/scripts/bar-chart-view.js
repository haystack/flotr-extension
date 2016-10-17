/**
 * @fileOverview
 * @author David Huynh
 * @author <a href="mailto:karger@mit.edu">David Karger</a>
 * @author <a href="mailto:ryanlee@zepheira.com">Ryan Lee</a>
 * @author Zhi X Huang
 * @author Denise Che (stacked bar chart)
 * @Library in use : Flotr2
 */

/**==================================================
 *  Exhibit.BarChartView
 *  Creates a bar graph with the items going down the y-axis
 *  and the bars extending out along the x-axis. Supports
 *  logarithmic scales on the x-axis, the color coding True/False
 *  functionality of ScatterPlotView, an ex:scroll option, and stacked charts.
 *
 *  It was born of ScatterPlotView, so there may be unnecessary code
 *  in this file that wasn't pruned.
 *==================================================
 */

Exhibit.BarChartView = function(containerElmt, uiContext) {
	var view = this;
	Exhibit.jQuery.extend(this, new Exhibit.View("barChart", containerElmt, uiContext));

	this.addSettingSpecs(Exhibit.BarChartView._settingSpecs);

	this._accessors = {
		getProxy : function(itemID, database, visitor) {
			visitor(itemID);
		},
		getColorKey : null
	};

	// Function maps that allow for other axis scales (logarithmic, etc.), defaults to identity/linear
	//this._axisFuncs = { x: function (x) { return x; }, y: function (y) { return y; } };
	this._axisFuncs = {
		x : function(x) {
			return x;
		}
	};
	this._axisInverseFuncs = {
		x : function(x) {
			return x;
		}
	};
	//this._axisInverseFuncs = { x: function (x) { return x; }, y: function (y) { return y; } };

	this._colorKeyCache = new Object();
	this._maxColor = 0;

	this._onItemsChanged = function() {
		view._reconstruct();
	};

	Exhibit.jQuery(uiContext.getCollection().getElement()).bind("onItemsChanged.exhibit", view._onItemsChanged);

	this.register();
};
Exhibit.BarChartView._settingSpecs = {
	"plotHeight" 		: {type : "int", 	 defaultValue : 400, description: "height of plot in pixels", importance: 2},
	"plotWidth"			: {type : "int", description: "width of plot in pixels", importance: 2},
	"xAxisMin" 			: {type : "float", 	 defaultValue : Number.POSITIVE_INFINITY, description: "minimum value on X-axis", importance:5},
	"xAxisMax" 			: {type : "float", 	 defaultValue : Number.NEGATIVE_INFINITY, description: "maximum value on X-axis", importance: 5},
	"axisType" 			: {type : "enum", 	 defaultValue : "linear",choices : ["linear", "logarithmic", "log"], description: "scale for X-axis", importance: 6},
	"valueLabel" 		: {type : "text",	 defaultValue : "x", description: "axis label for dependent variable", importance: 7},
	"groupLabel" 		: {type : "text",	 defaultValue : "y", description: "axis label for independent variable", importance: 7},
	"color" 			: {type : "text",	 defaultValue : "#FF9000", description: "all bars in graph will be of this color in the absence of color coders", importance: 2},
	"colorCoder" 		: {type : "text",	 defaultValue : null, description: "id of color coder", importance: 2},
	"verticalChart"  	: {type : "boolean", defaultValue : true, description: "orientation of bars; bars go horizontally in a vertical chart", importance: 6},
	"lineChart"			: {type : "boolean", defaultValue : false, description: "plot data as a line instead of bars", importance: 6},
	"tickNum"			: {type : "int", description: "number of ticks along the axis", importance: 2},
	"barWidth"			: {type : "float",   defaultValue : 0.8, description: "width of each bar", importance: 2},
	"stacked"			: {type : "boolean", defaultValue : false, description: "stacking of bars when values contain multiple properties", importance: 6},
	"stackLabels"		: {type : "text", 	 defaultValue: "", dimensions: "*", description: "comma separated list of one or more labels for each stack; used when values contain multiple properties", importance: 6}
};

Exhibit.BarChartView._accessorSpecs = [{
	accessorName : "getProxy",
	attributeName : "proxy",
	importance: 1
}, {
  accessorName : "getXY",
	alternatives : [{
		bindings : [{
			attributeName : "axisData",
			types : ["float", "text"],
			bindingNames : ["values", "groupedBy"]
		}]
	}, {
		bindings : [{
			attributeName : "values",
			dimensions: "*",
			type : "float",
			bindingName : "x"
		}, {
			attributeName : "groupedBy",
			type : "text",
			bindingName : "y"
		}]
	}],
	required: true,
	description: "values: comma separated list of one or more properties to plot \n\
								groupedBy: property used to label each item",
	importance: 9
}	, {
	accessorName : "getColorKey",
	attributeName : "colorKey",
	type : "text",
	description: "property used by the color coder",
	importance: 2
}];

Exhibit.BarChartView.create = function(configuration, containerElmt, uiContext) {
	var view = new Exhibit.BarChartView(containerElmt, Exhibit.UIContext.create(configuration, uiContext));
	Exhibit.BarChartView._configure(view, configuration);

	view._internalValidate();
	view._initializeUI();
	return view;
};

Exhibit.BarChartView.createFromDOM = function(configElmt, containerElmt, uiContext) {
	var configuration = Exhibit.getConfigurationFromDOM(configElmt);
	var view = new Exhibit.BarChartView(containerElmt != null ? containerElmt : configElmt, Exhibit.UIContext.createFromDOM(configElmt, uiContext));
	Exhibit.SettingsUtilities.collectSettingsFromDOM(configElmt, view.getSettingSpecs(), view._settings);
	Exhibit.SettingsUtilities.createAccessorsFromDOM(configElmt, Exhibit.BarChartView._accessorSpecs, view._accessors);
	Exhibit.BarChartView._configure(view, configuration);

	view._internalValidate();
	view._initializeUI();
	return view;
};

Exhibit.BarChartView._configure = function(view, configuration) {
	Exhibit.SettingsUtilities.createAccessors(configuration, Exhibit.BarChartView._accessorSpecs, view._accessors);
	Exhibit.SettingsUtilities.collectSettings(configuration, view.getSettingSpecs(), view._settings);

	view._axisFuncs.x = Exhibit.BarChartView._getAxisFunc(view._settings.axisType);
	view._axisInverseFuncs.x = Exhibit.BarChartView._getAxisInverseFunc(view._settings.axisType);

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

// Convenience function that maps strings to respective functions
Exhibit.BarChartView._getAxisFunc = function(s) {
	if (s == "logarithmic" || s == "log") {
		return function(x) {
			return (Math.log(x) / Math.log(10.0));
		};
	} else {
		return function(x) {
			return x;
		};
	}
}
// Convenience function that maps strings to respective functions
Exhibit.BarChartView._getAxisInverseFunc = function(s) {
	if (s == "log" || s == "logarithmic") {
		return function(x) {
			return Math.pow(10, x);
		};
	} else {
		return function(x) {
			return x;
		};
	};
}

Exhibit.BarChartView._colors = ["FF9000", "5D7CBA", "A97838", "8B9BBA", "FFC77F", "003EBA", "29447B", "543C1C"];
Exhibit.BarChartView._mixColor = "FFFFFF";

Exhibit.BarChartView.evaluateSingle = function(expression, itemID, database) {
	return expression.evaluateSingleOnItem(itemID, database).value;
}

Exhibit.BarChartView.prototype.dispose = function() {
	Exhibit.jQuery(this.getUIContext().getCollection().getElement()).unbind("onItemsChanged.exhibit", this._onItemsChanged);

	this._dom.dispose();
	this._dom = null;

	this._dispose();
};

Exhibit.BarChartView.prototype._internalValidate = function() {
	if ("getColorKey" in this._accessors) {
		if ("colorCoder" in this._settings) {
			this._colorCoder = this.getUIContext().getMain().getComponent(this._settings.colorCoder);
		}

		if (this._colorCoder == null) {
			this._colorCoder = new Exhibit.DefaultColorCoder(this.getUIContext());
		}
	}
};

Exhibit.BarChartView.prototype._initializeUI = function() {
	var self = this;
	var legendWidgetSettings = "_gradientPoints" in this._colorCoder ? "gradient" : {}

	this._dom = Exhibit.ViewUtilities.constructPlottingViewDom(this.getContainer(), this.getUIContext(), true, // showSummary
	{
		onResize : function() {
			self._reconstruct();
		}
	}, legendWidgetSettings);
	this._dom.plotContainer.className = "exhibit-barChartView-plotContainer";
	this._dom.plotContainer.style.height = this._settings.plotHeight + "px";
	if (this._settings.plotWidth){
		this._dom.plotContainer.style.width = this._settings.plotWidth + "px";
	}
	
	this._reconstruct();
};

// Why database = this._settings, but scaleX = self._axisFuncs.x ??
// Ah, because one block from david, other from mason

/** Where all the good stuff happens. There is a canvas div, in
 *  which resides a table. The left side is filled up with divs
 *  labeling the bars, and the right side is filled up with divs
 *  serving as the bars.
 */

Exhibit.BarChartView.prototype._reconstruct = function() {
	var self, colorCodingFlags, collection, container, database, settings, flotrCoord, unplottableItems, color, accessors, vertical_chart, scaleX, unscaleX, currentSize, xyDataPub;
	self = this;
	colorCodingFlags = {
		mixed : false,
		missing : false,
		others : false,
		keys : new Exhibit.Set()
	};
	
	collection = this.getUIContext().getCollection();
	database = this.getUIContext().getDatabase();
	settings = this._settings;
	accessors = this._accessors;
	vertical_chart = settings.verticalChart;
	this._dom.plotContainer.innerHTML = "";

	scaleX = self._axisFuncs.x;
	unscaleX = self._axisInverseFuncs.x;

	currentSize = collection.countRestrictedItems();

	xyDataPub = [];
	flotrCoord = {};
	unplottableItems = [];
	color = settings.color;
	this._dom.legendWidget.clear();
	prepareData = function() {
		var index, xAxisMin, xAxisMax, hasColorKey, currentSet, xDiff, numStacks;
		currentSet = collection.getRestrictedItems();
		hasColorKey = (self._accessors.getColorKey != null);
		index = 0;
		xAxisMin = settings.xAxisMin;
		xAxisMax = settings.xAxisMax;
		numStacks = 1;

		/*
		 *  Iterate through all items, collecting min and max on both axes
		 */
		currentSet.visit(function(itemID) {
  		var group, xys, colorKeys, xy, xyKey, xyData, barSum;
  		group = [];
  		if (hasColorKey){
				accessors.getColorKey(itemID, database, function(item) {
					group.push(item);
				}); 
			}
			if (group.length > 0) {
				colorKeys = null;
				
				if (hasColorKey) {
					colorKeys = new Exhibit.Set();
					accessors.getColorKey(itemID, database, function(v) {
						colorKeys.add(v);
					});
					color = self._colorCoder.translateSet(colorKeys, colorCodingFlags);
				}
			};			
			
			xys = [];
			
			self._getXY(itemID, database, function(axisData) {
				xys.push(axisData);
			});

			if (xys.length > 0) {
				colorKeys = null;
				if (hasColorKey) {
					colorKeys = new Exhibit.Set();
					accessors.getColorKey(itemID, database, function(v) {
						colorKeys.add(v);
					});
					color = self._colorCoder.translateSet(colorKeys, colorCodingFlags);
				}
				else {
					color = settings.color;
				}
				
				for (var i = 0; i < xys.length; i++) {
					xy = xys[i];
					barSum = 0;
					if (Array.isArray(xy.x)) {
						numStacks = xy.x.length;
					} else {
						xy.x = [xy.x];
					}
			
					xy['scaledX'] = [];
					for (var j = 0; j < numStacks; j++) {
						if (!settings.stacked) {
							try {
								var scaled_value = scaleX(xy['x'][j]);
								xy['scaledX'].push(scaled_value);
								if (!isFinite(xy['scaledX'][j])) {
									continue;
								}
								xAxisMin = Math.min(xAxisMin, scaled_value);
								xAxisMax = Math.max(xAxisMax, scaled_value);
							} catch (e) {
								continue;
								// ignore the point since we can't scale it, e.g., log(0)
							}
						} else {
							// scaling doesn't make sense for stacked values, so use original value
							xy['scaledX'].push(xy['x'][j]);
							barSum = barSum + xy['x'][j];
						}
					}
					if (settings.stacked) {
						xAxisMin = Math.min(xAxisMin, barSum);
						xAxisMax = Math.max(xAxisMax, barSum);
					}										

					xyData = {
						xy : xy,
						items : [itemID]

					};
					if (hasColorKey) {
						xyData.colorKeys = colorKeys;
					}
				}
			} else {
				unplottableItems.push(itemID);
			}
			if ( typeof xyData == "object") {
				if (vertical_chart){
					xyData.xy.z=index;
					index--;
					if (numStacks == 1){
						try {
							flotrCoord[color].push([xyData.xy.scaledX[0], xyData.xy.z]);
						}
						catch(e){
							flotrCoord[color] = [[xyData.xy.scaledX[0], xyData.xy.z]];
						}
					} else{
						for (var j = 0; j < numStacks; j++){
							try {
								flotrCoord[j].push([xyData.xy['scaledX'][j], xyData.xy.z]);
							}
							catch(e){
								flotrCoord[j] = [[xyData.xy['scaledX'][j], xyData.xy.z]];
							}
							if (!settings.stacked){
								xyData.xy.z = xyData.xy.z - 1 / (numStacks + 1);
							}
						}
					}	
				}
				else{
					xyData.xy.z=index;
					index++;
					if (numStacks == 1){
						try {
							flotrCoord[color].push([xyData.xy.z, xyData.xy.scaledX[0]]);
						}
						catch(e){
							flotrCoord[color] = [[xyData.xy.z, xyData.xy.scaledX[0]]];
						}
					} else{
						for (var j = 0; j < numStacks; j++){
							try {
								flotrCoord[j].push([xyData.xy.z, xyData.xy['scaledX'][j]]);
							}
							catch(e){
								flotrCoord[j] = [[xyData.xy.z, xyData.xy['scaledX'][j] ]];
							}
							if (!settings.stacked){
								xyData.xy.z = xyData.xy.z + 1 / (numStacks + 1);
							}
						}
					}
				};
				xyData.xy.color = color;
				xyDataPub.push(xyData);
			}
		});
		/*
		 *  Finalize mins, and maxes for both axes
		 */
		xDiff = xAxisMax - xAxisMin;

		if (isFinite(xDiff)) {
			var xInterval = 1;
			if (xDiff > 1) {
				while (xInterval * 20 < xDiff) {
					xInterval *= 10;
				}
			} else {
				while (xInterval > xDiff * 20) {                //There was a typo here.
					xInterval /= 10;			//Often crashes the browser when something isn't done correctly.
				}
			}

			settings.xAxisMin = Math.floor(xAxisMin / xInterval) * xInterval;
			settings.xAxisMax = Math.ceil(xAxisMax / xInterval) * xInterval;
		}
	}
	
	if (currentSize > 0){
		prepareData();

		container = document.createElement("div");
		container.className = "barChartViewContainer";
		container.style.height = "100%";
		this._dom.plotContainer.appendChild(container);

		this._flotrConstructor(xyDataPub, flotrCoord, container, currentSize);
	}
	
	this._dom.setUnplottableMessage(currentSize, unplottableItems);
};

Exhibit.BarChartView.prototype._flotrConstructor = function(xyDataPub, flotrCoord, container,  currentSize) {
	var self, settings, xAxisMax, xAxisMin, vertical_chart, axisScale, popupPresent, accessClosest, values, numStacks;
	self = this;
	settings= this._settings;
	line_chart  =settings.lineChart;
	xAxisMax = settings.xAxisMax;
	xAxisMin = settings.xAxisMin;
	vertical_chart = settings.verticalChart;
	axisScale = settings.axisType;
	num_tick = settings.tickNum;
	stacked = settings.stacked;
	stackLabels = settings.stackLabels;
	numStacks = 0;
	for (var i in flotrCoord) {
		numStacks ++;
	}
	


		
			Flotr.addPlugin('clickHit', {
				callbacks : {
					'flotr:click' : function(e) {
						
						this.clickHit.clickHit(e);
					}
				},

				clickHit : function(mouse) {
					var closest = this.clickHit.closest(mouse);
					accessClosest = closest;
				},
				

				closest : function(mouse) {

					var series = this.series, options = this.options, mouseX = mouse.x, mouseY = mouse.y, compare = Number.MAX_VALUE, compareX = Number.MAX_VALUE, compareY = Number.MAX_VALUE, compareXY = Number.MAX_VALUE, closest = {}, closestX = {}, closestY = {}, check = false, serie, data, distance, distanceX, distanceY, x, y, i, j,within_bar;
					function setClosest(o) {
						o.distance = distance;
						o.distanceX = distanceX;
						o.distanceY = distanceY;
						o.seriesIndex = i;
						o.dataIndex = j;
						o.x = x;
						o.y = y;
					}
					
					for ( i = 0; i < series.length; i++) {

						serie = series[i];
						data = serie.data;

						if (data.length)
							check = true;

						for ( j = data.length; j--; ) {

							x = data[j][0];
							y = data[j][1];

							if ((x === null && !vertical_chart)||(y === null && vertical_chart))
								continue;

							distanceX = Math.abs(x - mouseX);
							distanceY = Math.abs(y - mouseY);

							if (vertical_chart && !line_chart){
								distance = distanceY
							}else if (!vertical_chart && !line_chart){
								distance = distanceX
							}else if (line_chart){
								distance = distanceX*distanceX+distanceY*distanceY;
							}

							if (distance < compare) {
								compare = distance;
								setClosest(closest);
							}

							if (distanceX < compareX && !vertical_chart) {
								compareX = distanceX;
								setClosest(closestX);
								(mouseY>=0 && mouseY-y<.04*xAxisMax)? within_bar = true : within_bar = false;
							}
							if (distanceY < compareY && vertical_chart) {
								compareY = distanceY;
								setClosest(closestY);
								(mouseX>=0 && mouseX-x<.04*xAxisMax)? within_bar = true : within_bar = false;
							}
							if (line_chart && (Math.abs(mouseY-y)+Math.abs(mouseX-x))<compareXY){
								if (Math.abs(mouseY-y)+Math.abs(mouseX-x)<.01*xAxisMax) {
									compareXY = (Math.abs(mouseY-y)+Math.abs(mouseX-x));
									within_bar = true;
									setClosest(closest);
								}else{
									within_bar = false;
								}
							}
						}
					}

					return check&&within_bar?{
						point : closest,
						x : closestX,
						y : closestY
					} : false;
				}
			});
		
		
		popupPresent = false;
		
		Exhibit.jQuery('body').click(function(e) {
			var numtickFn, tickFormatterFn;

			//close the existing popUp if the user has clicked outside the popUp
			if (popupPresent) {
				if (!Exhibit.jQuery(e.target).closest('.simileAjax-bubble-contentContainer.simileAjax-bubble-contentContainer-pngTranslucent').length) {
					popupPresent = false;
					Exhibit.jQuery('.simileAjax-bubble-container').hide();
				};
			}
			
			if (!popupPresent) {
				if (Exhibit.jQuery(e.target).closest(container).length){
					if (line_chart){
						var items = xyDataPub[Math.abs(accessClosest.point.dataIndex)].items;
					}else if (!vertical_chart){
						var items = xyDataPub[Math.abs(accessClosest.x.x)].items;	
					}else{
						var items = xyDataPub[Math.abs(accessClosest.y.y)].items;
					}
					popupPresent = true;
					Exhibit.ViewUtilities.openBubbleWithCoords(e.pageX, e.pageY, items, self.getUIContext());
				}
			
			}
		});

			numtickFn = function(horizontal_bars, axis) {
				if ((horizontal_bars && axis == "y") || (!horizontal_bars && axis == "x")) {
					// if (!stacked && numStacks > 0){
					// 	return currentSize * numStacks;
					// }
					return currentSize;
				} else {
					if(num_tick){
						return num_tick;
					}else{
						return Math.min(5, currentSize+1);
					}
				}
			}
			tickFormatterFn = function(n, axis){
				var b = Math.abs(parseFloat(n)), verticalness = vertical_chart;
				if (axis != "x"){
					verticalness = !vertical_chart;
				}
				if (!verticalness) {
					try {
						if(typeof xyDataPub[b].xy.y != "undefined"){
							return xyDataPub[b].xy.y;
						}
					} catch(e) {
						return "";
					}
				} else {
					if ((axisScale == "logarithmic" || axisScale == "log") && !stacked) {
						return "10^" + n;
					}
					return n;
				}
				return "";
			}
			
			/*
			 * Used to fix the tick cutoff issuse that occurs when when no chart title is used.
			 */
			Flotr.addPlugin('margin', {
				callbacks : {
					'flotr:afterconstruct' : function() {
						this.plotOffset.left += this.options.fontSize * .5;
						this.plotOffset.right += this.options.fontSize * 3;
						this.plotOffset.top += this.options.fontSize * 3;
						this.plotOffset.bottom += this.options.fontSize * .5;
					}
				}
			});
			var xMin, yMin, label2, xAxislabel, yAxislabel;
			vertical_chart == true ? ( xMin = xAxisMin, yMin = null, xAxislabel = settings.valueLabel, yAxislabel = settings.groupLabel) : ( xMin = null, yMin = xAxisMin, xAxislabel = settings.groupLabel, yAxislabel = settings.valueLabel);


			var dataList = [], barW = this._settings.barWidth, label = false, labelList = [];
			// generate stack labels
			if (stackLabels != ""){
				label = true;
				labelList = stackLabels;
			}
			if (!stacked && numStacks == 1){
				for (k in flotrCoord){
					dataList.push({data:flotrCoord[k], color:k});
				}
			} else{
				for (k in flotrCoord){
					if (!label){
						dataList.push({data: flotrCoord[k]});
					} else{
						dataList.push({data: flotrCoord[k], label: labelList[k].trim()});
					}
				}
			}

			if (barW > 1.0 || barW <=0.0){
				barW = 0.8;			//keep at <= 1.0 for the bars to display properly.
			}

			if (!stacked && numStacks > 1){
				barW = barW / (numStacks + 1);
			}
			
			Flotr.draw(container, dataList, {
				HtmlText : false,
				lines: {
					show : line_chart,
				},
				points: {
            		show: line_chart,
        		},
        		legend : {
					backgroundColor : '#D2E8FF' // Light blue 
				},	
				bars : {
					show : !line_chart,
					horizontal : vertical_chart,
					shadowSize : 0,
					barWidth : barW,
					stacked : stacked
				},
				grid: {
 				    color: '#000000',
            		verticalLines : vertical_chart||line_chart,
            		horizontalLines : (!vertical_chart)||line_chart
        	},
				mouse : {
					track : true,
					trackFormatter: function(o){
						if(!vertical_chart){
							return xyDataPub[Math.abs(o.x)].xy.y + ": " + o.y;
						}else{
							
						return xyDataPub[Math.abs(o.y)].xy.y + ": " + o.x;
						}
						
					}
				},
				xaxis : {
					min : xMin,
					labelsAngle : 45,
					noTicks : numtickFn(vertical_chart, "x"),
					title : xAxislabel,
					tickFormatter : function(n) {
						return tickFormatterFn(n, "x");
					}
				},
				yaxis : {
					min : yMin,
					noTicks : numtickFn(vertical_chart, "y"),
					title : yAxislabel,
					tickFormatter : function(n) {
						return tickFormatterFn(n, "y");
					}
				}
			});
};
