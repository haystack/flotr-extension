/*==================================================
 *  Simile Exhibit Flotr Extension
 *==================================================
 */

(function() {
    var isCompiled = ("Exhibit_FlotrExtension_isCompiled" in window) && 
                    window.Exhibit_FlotrExtension_isCompiled;
                    
    Exhibit.FlotrExtension = {
        params: {
            bundle: true
        } 
    };

    var scriptName = "flotr";

    var extensionName = "Flotr extension";

    var javascriptFiles = [
        "bar-chart-view.js",
        "scatter-plot-view.js"
    ];

    var javascriptLibs = [
                          "flotr2.min.js"
                          ];

    var cssFiles = [
                    ];
    
    var paramTypes = { bundle: Boolean };
    if (typeof Exhibit_FlotrExtension_urlPrefix == "string") {
        Exhibit.FlotrExtension.urlPrefix = Exhibit_FlotrExtension_urlPrefix;
        if ("Exhibit_FlotrExtension_parameters" in window) {
            Exhibit.parseURLParameters(Exhibit_FlotrExtension_parameters,
                                          Exhibit.FlotrExtension.params,
                                          paramTypes);
        }
    } else {
        var url = Exhibit.findScript(document, "/" + scriptName + "-extension.js");
        if (url == null) {
            Exhibit.Debug.exception(new Error("Failed to derive URL prefix for " + extensionName));
            return;
        }
        Exhibit.FlotrExtension.urlPrefix = url.substr(0, url.indexOf(scriptName + "-extension.js"));
        
        Exhibit.parseURLParameters(url, Exhibit.FlotrExtension.params, paramTypes);
    }
    
    var scriptURLs = [];
    var cssURLs = [];
    
    if (Exhibit.FlotrExtension.params.bundle) {
        scriptURLs.push(Exhibit.FlotrExtension.urlPrefix + scriptName + "-extension-bundle.js");
        cssURLs.push(Exhibit.FlotrExtension.urlPrefix + scriptName + "-bundle.css");
    } else {
        Exhibit.prefixURLs(scriptURLs, Exhibit.FlotrExtension.urlPrefix + "scripts/", javascriptFiles);
        Exhibit.prefixURLs(scriptURLs, Exhibit.FlotrExtension.urlPrefix + "lib/", javascriptLibs);
        Exhibit.prefixURLs(cssURLs, Exhibit.FlotrExtension.urlPrefix + "styles/", cssFiles);
    }

    
    for (var i = 0; i < Exhibit.locales.length; i++) {
        scriptURLs.push(Exhibit.FlotrExtension.urlPrefix + "locales/" + Exhibit.locales[i] + "/" + scriptName + "-locale.js");
    };
    
    if (!isCompiled) {
        Exhibit.includeJavascriptFiles("", scriptURLs, false);
        Exhibit.includeCssFiles(document, "", cssURLs);
    }
})();
