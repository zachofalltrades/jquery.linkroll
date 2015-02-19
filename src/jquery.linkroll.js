/**
* linkroll - jQuery plugin to load and/or format linkrolls.
* https://github.com/zachofalltrades/jquery.linkroll
*
* Version - 0.1
* Copyright (c) 2015 Zach Shelton
* http://zachofalltrades.net
*
* Dual licensed under the MIT and GPL licenses:
* http://www.opensource.org/licenses/mit-license.php
* http://www.gnu.org/licenses/gpl.html
*  
* JSONEditor functionality is (currently) handled in the cloud via "JSON Blob"
* https://jsonblob.com/about
* 
* JSONProxy functionality is handled in the cloud via NodeJitsu
* https://jsonp.nodejitsu.com/
*/

(function( $ ) { //begin closure 

/*** private internal constants ***/
var urlPartsRegX       = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/,
	iconForUrl         = "//www.google.com/s2/favicons?domain_url=", 
	iconForHost        = "//www.google.com/s2/favicons?domain=",
	supportedMethods   = ["append","prepend","before","after","html"],
	jsonProxy          = "https://jsonp.nodejitsu.com/?callback=?&url=",
	jsonEditorEndpoint = "https://jsonblob.com",
	jsonEditorApi      = "/api/jsonBlob",
	FileApiSupported   = window.File && window.FileReader && window.FileList,
	DialogApiAvailable = $.isFunction($.fn.dialog),
	debugEnabled       = window.console && window.console.log && true,
	NotSupported       = "feature not supported";


/**
* add DOM chaining method to global jQuery object
* @param {object} options - an optional object specifying overrides of the default configuration
*/
$.fn.linkroll = function ( options ) {
	return this.each(function(){
		var node = $(this);
		var roller = new LinkRoll(options, node);
		if (roller.options.jsonUrl) {
			roller.loadFromJsonUrl(roller.options.jsonUrl);
		} else {
			if (node.is("a")) {
				roller.insertImage(node);
			} else {
				node.find("a").each(function (){
					var subNode = $(this);
					roller.insertImage(subNode);
				});
			}
			if ($.isFunction(roller.options.onSuccess)) {
				roller.options.onSuccess(node);
			}
		}
		if ( roller.options.buttons ) {
			node.after(roller.getWidget());
		};
		return this;
	});
};

/**
 * expose a "read-only" copy of the supported insertion methods
 */
$.fn.linkroll.methods = function() {
	return 	supportedMethods.slice();
};

/**
 * default configuration is globally accessible to allow overrides
 */
$.fn.linkroll.defaults = {
	addClass    : "linkroll", //class name to add to all created/modified elements
	method      : "append",  //jQuery node insertion method for img tag (must be one of the supported methods)
	jsonUrl     : false,      //optinal url of json to be loaded
	useProxy    : false,      //set true if json url is (trusted) remote host that does not enable CORS or JSONP
	onSuccess   : false,      //optional callback function to apply additional formatting (useful when loading json async)
	buttons     : {
		//a set of buttons that can be added to the UI when building from JSON
		loadFromFile : false,
		loadFromUrl  : false,
		exportJson   : false,
		editJson     : false,
		reloadFromUrl: false,
		clear        : false
	},
	jsonTemplate: {
		begin: "",
		beforeEachCategory: "<h3>",
		eachCategory: "<h3>##CATEGORY##</h3>",
		afterEachCategory: "</h3>",
		beforeChildren: "<div><ul>",
		afterChildren: "</ul></div>",
		beforeEachLink: "",
		eachLink: "<li class='linkroll' style=\"list-style-image: url('##ICONURL##');\"><a href='##SITEURL##'>##SITENAME##</a></li>",
		afterEachLink: '',
		end:   "",
		replaceWithCategory: "##CATEGORY##",
		replaceWithIconUrl:  "##ICONURL##",
		replaceWithSiteUrl:  "##SITEURL##",
		replaceWithSiteName: "##SITENAME##"
	}
};



/**
 * get a new LinkRoll object
 * @constructor
 * @param {Object} opts - overrides of $.fn.linkroll.defaults
 */
function LinkRoll ( opts, target ) {
	var //private member variables/methods are declared in constructor ( http://javascript.crockford.com/private.html )
	targetNode = target, //DOM node where linkroll will be rendered
	sourceUrl  = null,   //most recently loaded source url
	myWidget   = null,
	jsonModel  = null,   //most recently loaded json object
	//watch for changes...
	//https://gist.github.com/eligrey/384583 
	//https://api.jquery.com/category/events/event-object/
	that = this,        //private reference to current instance

	/**
	 * private initialization routine
	 */
	init = function ( opts ) {
		that.options = $.extend({}, $.fn.linkroll.defaults, opts);
		//ensure that selected method is supported
		that.options.method = ($.inArray(that.options.method, supportedMethods)) ? that.options.method : supportedMethods[0];
		if ( that.options.jsonUrl ) {
			that.sourceUrl = that.options.jsonUrl;
		};
		if (that.options.buttons===true) {//set all buttons to true
			that.options.buttons = {
				loadFromFile : true,
				loadFromUrl  : true,
				exportJson   : true,
				editJson     : true,
				reloadFromUrl: true,
				clear        : true
			};
		};
	},
	
	
	/**
	 * 
	 */
	updateSourceUrl = function ( url ) {
		var temp = url;
		if ( that.options.useProxy ) {
			//prefix with proxy only if it has not already bee prefixed
			if ( url.indexOf( jsonProxy ) === -1) {
				temp = jsonProxy + url;
			};
		};
		sourceUrl = temp;
	};
	
	/**
	 * priveleged methods are assigned to 'this' from inside the constructor
	 */

	/**
	 * load the given data 
	 * @param {Object} jsonData - the data to load
	 */
	this.buildFromJson = function( jsonData ) {
		var opts = this.options;
		var template = opts.jsonTemplate;
		var callback = opts.onSuccess;
		jsonModel = toNativeFormat(jsonData);  //save json object to internal model
		var content = [];                           //temp array to build a string
		if (template.begin) {
			content.push( template.begin );
		};
		recurseBookmarks(content, template, jsonModel);
		if (template.end) {
			content.push( template.end );
		};
		targetNode.html( content.join("") );
		if ( opts.addClass ) {
			targetNode.addClass( opts.addClass );
		};
		if ($.isFunction( callback ) ) {
			callback( targetNode );
		};
	};

	this.clear = function() {
		if (targetNode) {
			targetNode.empty();
		}
	};
	
	this.reload = function() {
		if (sourceUrl && targetNode) {
			that.loadFromJsonUrl( sourceUrl );
		}
	}
	/**
	 * load data from url 
	 * @param {String} url - a json url
	 */
	this.loadFromJsonUrl = function ( url ) {
		updateSourceUrl( url );
		$.getJSON( sourceUrl ).done( function ( data ) {
			that.buildFromJson( data );
		});
	};
	
	init(opts);//call the private initialization method

}//end LinkRoll constructor

/**
 * 
 */ 
LinkRoll.prototype = {
	//all properties and methods defined in the prototype are PUBLIC
	options: {},

	/**
	 * insert an <img> into the DOM by a link using one of the supported insertion methods
	 * @param {Object} link - an <a> element selected by jQuery
	 */
	insertImage: function ( link ) {
		var href = $(link).attr("href");
		var url = getIconUrl( href );
		var img = $("<img />", {src: url});
		if ( this.options.addClass ) {
			img.addClass( this.options.addClass );
			link.addClass( this.options.addClass );
		}
		var insertionMethod = link[this.options.method];
		insertionMethod.call( link, img );
	},
	
	getWidget: function () {
		var hasButton = this.options.buttons;
		var widget = $("<div/>");
		if ( hasButton ) {
			if ( hasButton.loadFromFile ) {
				widget.append(this.LoadFromFileButton());
			};
			if ( hasButton.loadFromUrl ) {
				widget.append(this.LoadFromUrlButton());
			};
			if ( hasButton.exportJson ) {
				widget.append(this.ExportButton());
			};
			if ( hasButton.editJson ) {
				widget.append(this.EditButton());
			};
			if ( hasButton.reloadFromUrl ) {
				widget.append(this.ReloadButton());
			};
			if ( hasButton.clear ) {
				widget.append(this.ClearButton());
			};
		
		}
		this.myWidget = widget;
		return widget;
	},
	
	popup: function ( url, title ) {
		if ( DialogApiAvailable && this.myWidget) {
			var t = (title) ? title : "LinkRoller";
			var h = window.innerHeight - 10;
			var w = window.innerWidth - 10;
			var iframe = $("<iframe height='"+(h-100)+"' width='"+(w-100)+"' frameborder='0' marginwidth='0' marginheight='0' src='" + url + "' />");
			var diag = $("<div id='mydialog' />");
			diag.append(iframe);
			var that = $(this.myWidget);
			that.append(diag);
			diag.dialog( { 
				title: t,
				modal: true,
				resizable: true,
				height: "auto",
				width: w,
				close: function () {
					$("#mydialog").remove();
				}
			} );
		} else {
			var win = window.open( url, t );
			win.focus();
		}
	},
	
	LoadFromFileButton: function () {
		var span = $("<span/>");
		if ( FileApiSupported ) {
			var that = this;
			var input = $("<input />", { type: "file", css: { visibility: "hidden", width: 0, height: 0 } } );
			input.attr("accept", "json");
			input.on("change", function( evt ) {
			    var files = evt.target.files;  // HTML5 FileList
			    var f = files[0];              // HTML5 File
			    var reader = new FileReader(); // HTML5 FileReader
			    reader.onload = ( function( theFile ) {
			        return function( e ) { 
			            var fileObj = e.target.result;
			            var data = JSON.parse(fileObj);
			            that.buildFromJson(data);
			        };
			    })(f);
			    reader.readAsText(f, "UTF-8");
			});
			var btn = $("<button/>", {type: "button"});
			btn.html("load from file");
			btn.click( function() {
				input.click();
			});
			span.append( btn );
			span.append( input );
		} else {
			span.html( NotSupported );
		}
		return span;
	},
	
	LoadFromUrlButton: function () {
		var that = this;
		var span = $("<span/>");
		var input = $("<input />", {type: "text"});
		input.bind("keypress", function (e) {
			if (e.keyCode == 13) {
				e.preventDefault();
				that.loadFromJsonUrl( input.val() );
			}
		});
		var btn = $("<button/>", {type: "button"});
		btn.html("load from url");
		btn.click( function () {
			that.loadFromJsonUrl( input.val() );
		});
		span.append( btn );
		span.append( input );
		return span;
	},
	
	EditButton: function() {
		var span = $("<span/>");
		if ( FileApiSupported ) {
			var that = this;
			var btn = $("<button/>", {type: "button"} );
			btn.html("edit");
			btn.click(function() {
				var reEdit = ( that.sourceUrl && that.sourceUrl.indexOf( jsonEditorEndpoint ) > -1 ) ? true : false;
				if ( reEdit ) {
					var editorUrl = that.sourceUrl.replace( jsonEditorApi, "" );
					that.popup(editorUrl, "editing via JSONBlob service, save here, then reload");
				} else {
					var jsonData = that.jsonModel;
					var jsonTxt = JSON.stringify(jsonData);
					$.ajax({
						url: jsonEditorEndpoint + jsonEditorApi,
						contentType: "application/json; charset=utf-8",
						type: "POST",
						data: jsonTxt,
						error: function (xhr, status) {
							alert(status);
						},
						success: function (data, status, xhr) {
							var location = xhr.getResponseHeader("location");
							that.sourceUrl = location;
							var editorUrl = location.replace(jsonEditorApi, "");
							that.popup(editorUrl, "editing via JSONBlob service, save here, then reload");
						}
					});
				}
			});
			span.append( btn );
		} else {
			span.html(NotSupported);
		}
		return span;
	},
	
	ExportButton: function() {
		var span = $("<span/>");
		if (FileApiSupported) {
			var that = this;
			var btn = $("<button/>",{type: "button"});
			btn.html("export");
			btn.click( function() {
				var data = that.jsonModel;
				var jsonTxt = JSON.stringify(data, null, " ");
				var blob = new Blob ( [ jsonTxt ], { type: "application/json" } );
				that.popup(URL.createObjectURL(blob), "LinkRoller Data");
			});
			span.append( btn );
		} else {
			span.html( NotSupported );
		}
		return span;
	},
	
	ReloadButton: function() {
		var that = this;
		var btn = $("<button/>");
		btn.html("reload");
		btn.click( function () {
			that.reload();
		});
		return btn;
	},

	ClearButton: function() {
		var that = this;
		var btn = $("<button/>");
		btn.html("clear");
		btn.click( function () {
			that.clear();
		});
		return btn;
	}
	
}; //end LinkRoll prototype

/**
 * This is a recursive function to dive into the data structure and render it as HTML
 * 
 * @param {Array} content - an array to accumulate rendered substrings
 * @param {Object} template - from teh LinkRoller options
 * @param {Object} folder - the current node in the tree that is being recursed
 */
function recurseBookmarks(content, template, folder) {
	if (Array.isArray(folder.children)) {
		for (var i in folder.children) {
			var child = folder.children[i];
			if (Array.isArray(child.children)) {
				content.push( template.beforeEachCategory + child.name + template.afterEachCategory );
				content.push( template.beforeChildren );
				recurseBookmarks(content, template, child);
				content.push( template.afterChildren );
			} else if (typeof child.uri==="string") {
				if ( template.beforeEachLink ) {
					content.push( formatSite( child, template.beforeEachLink, template ) );
				}
				if ( template.eachLink ) {
					content.push( formatSite( child, template.eachLink, template ) );
				}
				if ( template.afterEachLink ) {
					content.push( formatSite( child, template.afterEachLink, template ) );
				}
			} else {
				debug("!!!!!! UNEXPECTED OBJECT !!!!!!");
				debug(child);
			}
		}
	} else {
		debug("!!!!!!!!!!  NOT A FOLDER   !!!!!!!!");
		debug(folder);
	}
}
	

/**
 * recognize a data structure and return it in the native format
 * Supports: bookmark json formats for Chrome, Firefox, and the native "linkroll" format 
 * 
 * linkroll tree structure is a "folder" object with nested bookmark and folder objects 
 * 
 * Object (bookmark)
 * 		name		String
 * 		uri:		String
 * 
 * Object (folder)
 * 		name		String
 * 		children	Array [] -- objects in array may be bookmarks or folders
 * 
 * @param {Object} data - JSON object structure
 */
function toNativeFormat(data) {
	var normalData = {};
	if (Array.isArray(data) && data.length>0 && typeof data[0].category === "string" && Array.isArray(data[0].links)) {
		normalData.name = "old format";
		normalData.children = getFlatCategories(data);
	} else if (data.type==="text/x-moz-place-container") {
		normalData.name = "Mozilla Bookmarks";
		normalData.children = recurseMozilla(data);
	} else if (typeof data.roots==="object" && typeof data.roots.other==="object") {
		normalData.name = "Chrome Bookmarks";
		normalData.children = recurseChrome(data.roots.other);
	} else if (typeof data.name === "string" && Array.isArray(data.children)) {
		normalData = data;
	} else {
		normalData.name = "!!!!!!!   UNEXPECTED FORMAT   !!!!!!!!!";
		normalData.children = [];
	}
	debug(normalData.name)
	return normalData;
}


/******************************************************************************************
 * utility functions that are private to the plugin, but not part of each LinkRoll instance
 *****************************************************************************************/

/**
 * convert pre-release format to current version
 */
function getFlatCategories(data) {
	var myChildren = [];
	//TODO
	return myChildren;
}

/**
 * return a nested array of child objects
 * @param {object} parent - the current "folder"
 */
function recurseChrome(parent) {
	var myChildren = [];
	if ( Array.isArray( parent.children ) ) {
		for (var i in parent.children) {
			var child = parent.children[i];
			if ( child.type==="folder" && Array.isArray(child.children) && child.children.length > 0) {
				var grandchildren = recurseChrome(child);
				var folder = {name: child.name, children: grandchildren};
				myChildren.push(folder);
			} else if (child.type==="url") {
				var bookmark = {name: child.name, uri: child.url};
				myChildren.push(bookmark);
			}
		}
	}
	return myChildren;
}

/**
 * return a nested array of child objects
 * @param {object} parent - the current "container"
 */
function recurseMozilla (parent) {
	var myChildren = [];
	if ( Array.isArray( parent.children ) ) {
		for (var i in parent.children) {
			var child = parent.children[i];
			if ( child.type==="text/x-moz-place-container" && Array.isArray(child.children) && child.children.length > 0) {
				var grandchildren = recurseMozilla(child);
				var folder = {name: child.title, children: grandchildren};
				myChildren.push(folder);
			} else if (child.type==="text/x-moz-place") {
				var bookmark = {name: child.title, uri: child.uri};
				myChildren.push(bookmark);
			}
		}
	}
	return myChildren;
}

function debug(arg) {
	if ( debugEnabled ) {
		window.console.log(arg);
	};
};

function getIconUrl ( url ) {
	return iconForHost + urlPartsRegX.exec(url)[11];
}

function formatSite ( bookmark, layout, opts ) {
	//allow for multiple json structures...
	var url = (typeof bookmark.uri==="string") ? bookmark.uri : bookmark;
	var name = (typeof bookmark.name==="string") ? bookmark.name : urlPartsRegX.exec(url)[11];
	
	var temp = layout.replace(opts.replaceWithIconUrl, getIconUrl(url));
		temp = temp.replace(opts.replaceWithSiteUrl, url);
		temp = temp.replace(opts.replaceWithSiteName, name);
	return temp;
}
	
}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )


