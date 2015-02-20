/**
 * jquery-linkroll - v0.0.1 2015-02-20
 * A jQuery plugin to format a JSON bookmark file.
 * https://github.com/zachofalltrades/jquery.linkroll
 *
 * Copyright (c)2015 Zach Shelton
 * <zachofalltrades@users.sourceforge.net>  (http://zachofalltrades.net)
 * Released Under License:  MIT,GPL 
 */
 //begin closure 
;(function ( $, window, document, undefined ) { // jshint ignore:line  
	"use strict";

/*** private internal constants ***/
var urlPartsRegX       = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/,
//	iconForUrl         = "//www.google.com/s2/favicons?domain_url=", 
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
		if (!roller.isWidget) {
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
		file  : false,
		url   : false,
		raw   : false,
		edit  : false,
		reload: false,
		clear : false
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
		afterEachLink: "",
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
 * @param {Object} target - the jquery node where the json and/or widget will be loaded
 */
function LinkRoll ( opts, target ) {
	var
		exportButton, editButton, clearButton, reloadButton,
		targetNode = target, //DOM node where linkroll will be rendered
		sourceUrl  = null,   //most recently loaded source url
		//	myWidget   = null,
		jsonModel  = null,   //most recently loaded json object
		//watch for changes...
		//https://gist.github.com/eligrey/384583 
		//https://api.jquery.com/category/events/event-object/
		that = this;        //private reference to current instance

		function init ( opts ) {
				that.options = $.extend({}, $.fn.linkroll.defaults, opts);
				//ensure that selected method is supported
				that.options.method = ($.inArray(that.options.method, supportedMethods)) ? that.options.method : supportedMethods[0];
				
				if ( that.options.jsonUrl ) {
					loadFromJsonUrl( that.options.jsonUrl );
					that.isWidget = true;
				}
				var buttons = ( that.options.buttons ) ? that.options.buttons : false;
				if ( buttons === true ) {//set all buttons to true
					 buttons = {
							file  : true,
							url   : true,
							raw   : true,
							edit  : true,
							reload: true,
							clear : true
					};
				}
				if (hasAtLeastOneTrue(buttons)) {
					var widget = $("<div/>");
					
					if ( buttons.file && FileApiSupported ) {
						widget.append(loadFromFileButton(buildFromJson));
					}
					
					if ( buttons.url ) {
						widget.append(loadFromUrlButton(loadFromJsonUrl));
					}
					
					if ( buttons.raw && FileApiSupported ) {
									exportButton = $("<button/>",{type: "button", disabled: true});
									exportButton.html("export");
									exportButton.click( function() {
										var data = jsonModel;
										var jsonTxt = JSON.stringify(data, null, " ");
										var blob = new window.Blob ( [ jsonTxt ], { type: "application/json" } );
										popup(window.URL.createObjectURL(blob), "LinkRoller Data");
									});
						widget.append(exportButton);
					}

					if (buttons.edit && FileApiSupported) {
						editButton = $("<button/>", {
							type: "button",
							disabled: true
						});
						editButton.html("edit");
						editButton.click(function() {
							var reEdit = (sourceUrl && sourceUrl.indexOf(jsonEditorEndpoint) > -1) ? true : false;
							if (reEdit) {
								var editorUrl = sourceUrl.replace(jsonEditorApi, "");
								popup(editorUrl, "editing via JSONBlob service, save here, then reload");
							}
							else {
								var jsonTxt = JSON.stringify(jsonModel);
								$.ajax({
									url: jsonEditorEndpoint + jsonEditorApi,
									contentType: "application/json; charset=utf-8",
									type: "POST",
									data: jsonTxt,
									error: function(xhr, status) {
										window.alert(status);
									},
									success: function(data, status, xhr) {
										sourceUrl = xhr.getResponseHeader("location");
										var editorUrl = sourceUrl.replace(jsonEditorApi, "");
										popup(editorUrl, "editing via JSONBlob service, save here, then reload");
									}
								});
							}
						});
						
						widget.append(editButton);
					}
					
					if ( buttons.reload ) {
							reloadButton = $("<button/>", {disabled: true}).html("reload").click( 
									function () {
										loadFromJsonUrl( sourceUrl );
									});
							if (true) {
								reloadButton.tooltip();
							}
							widget.append( reloadButton );
					}
					
					if ( buttons.clear ) {
							clearButton = $("<button/>", {disabled: true}).html("clear").click( function () {
									targetNode.empty(); 
								 clearButton.prop("disabled", true);
							});
							widget.append( clearButton );
					}
					
					targetNode.before(widget);
					that.isWidget = true;
				}
	}
	
	function updateSourceUrl ( url ) {
		var temp = url;
		if ( that.options.useProxy ) {
			//prefix with proxy only if it has not already been prefixed
			if ( url.indexOf( jsonProxy ) === -1) {
				temp = jsonProxy + url;
			}
		}
		sourceUrl = temp;
		if (reloadButton) {
			if (temp==="") {
					reloadButton.prop("disabled", true);
			}else{
					reloadButton.prop("disabled", false);
					reloadButton.attr("title", "reload from '" + temp + "'");
			}
		}
	}
	
	/**
	 * load the given data 
	 * @param {Object} jsonData - the data to load
	 */
	function buildFromJson ( jsonData ) {
		var opts = that.options;
		var template = opts.jsonTemplate;
		var callback = opts.onSuccess;
		jsonModel = toNativeFormat(jsonData);  //save json object to internal model
		var content = [];                      //temp array to build a string
		if (template.begin) {
			content.push( template.begin );
		}
		recurseBookmarks(content, template, jsonModel);
		if (template.end) {
			content.push( template.end );
		}
		targetNode.html( content.join("") );
		if ( opts.addClass ) {
			targetNode.addClass( opts.addClass );
		}
		if (exportButton) {
			exportButton.prop("disabled", false);
		}
		if (clearButton) {
				clearButton.prop("disabled", false);
		}
		if ($.isFunction( callback ) ) {
			callback( targetNode );
		}
	}

	/**
	 * load data from url 
	 * @param {String} url - a json url
	 */
	function loadFromJsonUrl ( url ) {
		updateSourceUrl( url );
		$.getJSON( sourceUrl ).done( function ( data ) {
			buildFromJson( data );
		});
	}

	//still in constructor here, now do some some stuff...
	init(opts);//call the private initialization method
		
}//end LinkRoll constructor

LinkRoll.prototype = {
	options: {},
	isWidget: false,//set true by constructor if json/widget is loaded 
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
	}
	
}; //end LinkRoll prototype


function loadFromFileButton (loadFunction) {
		var span = $("<span/>");
		if ( FileApiSupported ) {
			var input = $("<input />", { type: "file", css: { visibility: "hidden", width: 0, height: 0 } } );
			input.attr("accept", "json");
			input.on("change", function( evt ) {
			    var files = evt.target.files;  // HTML5 FileList
			    var f = files[0];              // HTML5 File
			    var reader = new window.FileReader(); // HTML5 FileReader
			    reader.onload = ( function() {
			        return function( e ) { 
			            var fileObj = e.target.result;
			            var data = JSON.parse(fileObj);
			            loadFunction(data);
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
}

function	loadFromUrlButton (loadFunction) {
		var span = $("<span/>");
		var input = $("<input />", {type: "text"});
		input.bind("keypress", function (e) {
			if (e.keyCode === 13) {
				e.preventDefault();
				loadFunction( input.val() );
			}
		});
		var btn = $("<button/>", {type: "button"});
		btn.html("load from url");
		btn.click( function () {
			loadFunction( input.val() );
		});
		span.append( btn );
		span.append( input );
		return span;
}


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
	debug(normalData.name);
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
	debug(data);
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

function hasAtLeastOneTrue( obj ) {
		if (typeof obj === "object") {
				for(var prop in obj) {
					if (obj[prop]===true) {
						return true;
					}
				}
		}
		return false;
}


function popup( url, title ) {
		var t = (title) ? title : "LinkRoller";
		if ( DialogApiAvailable ) {
			var h = window.innerHeight - 10;
			var w = window.innerWidth - 10;
			var iframe = $("<iframe height='"+(h-100)+"' width='"+(w-100)+"' frameborder='0' marginwidth='0' marginheight='0' src='" + url + "' />");
			var diag = $("<div id='mydialog' />");
			diag.append(iframe);
			$("body").append(diag);
			diag.dialog( { 
				title: t,
				modal: true,
				resizable: true,
				height: "auto",
				width: w,
				close: function () {
					diag.remove();
				}
			} );
		} else {
			var win = window.open( url, t );
			win.focus();
		}
}


	
function debug(arg) {
	if ( debugEnabled ) {
		window.console.log(arg);
	}
}

}( jQuery, window, document )); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )


