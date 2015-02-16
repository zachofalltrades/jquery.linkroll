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
* JSONEditor functionality is (currently) handled in the cloud via 'JSON Blob'
* https://jsonblob.com/about
* 
* JSONProxy functionality is handled in the cloud via NodeJitsu
* https://jsonp.nodejitsu.com/
*/

(function( $ ) { //begin closure 

/*** private internal constants ***/
var urlPartsRegX       = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/,
	iconForUrl         = '//www.google.com/s2/favicons?domain_url=', 
	iconForHost        = '//www.google.com/s2/favicons?domain=',
	supportedMethods   = ['append','prepend','before','after','html'],
	jsonProxy          = 'https://jsonp.nodejitsu.com/?callback=?&url=',
	jsonEditorEndpoint = 'https://jsonblob.com',
	jsonEditorApi      = '/api/jsonBlob',
	FileApiSupported   = window.File && window.FileReader && window.FileList,
	DialogApi          = $.isFunction($.fn.dialog),
	NotSupported       = 'feature not supported';


/**
* add DOM chaining method to global jQuery object
* @param {object} options - an optional object specifying overrides of the default configuration
*/
$.fn.linkroll = function ( options ) {
	var roller = new LinkRoll(options);
	return this.each(function(){
		var node = $(this);
		roller.targetNode = node;
		if (roller.options.jsonUrl) {
			roller.loadFromJsonUrl(roller.options.jsonUrl);
		} else {
			if (node.is('a')) {
				roller.insertImage(node);
			} else {
				node.find('a').each(function (){
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
 * expose a 'read-only' copy of the supported insertion methods
 */
$.fn.linkroll.methods = function() {
	return 	supportedMethods.slice();
};

/**
 * default configuration is globally accessible to allow overrides
 */
$.fn.linkroll.defaults = {
	addClass    : 'linkroll', //class name to add to all created/modified elements
	method      : 'append',  //jQuery node insertion method for img tag (must be one of the supported methods)
	jsonUrl     : false,      //optinal url of json to be loaded
	useProxy    : false,      //set true if json url is (trusted) remote host that does not enable CORS or JSONP
	onSuccess   : false,      //optional callback function to apply additional formatting (useful when loading json async)
	buttons     : {
		//a set of buttons that can be added to the UI when building from JSON
		loadFromFile : false,
		loadFromUrl  : false,
		exportJson   : false,
		editJson     : false,
		reloadFromUrl: false
	},
	jsonTemplate: {
		begin: '',
		beforeEachCategory: '<h3>',
		afterEachCategory: '</h3>',
		beforeLinks: '<div><ul>',
		afterLinks: '</ul></div>',
		beforeEachLink: false,
		eachLink: "<li class='linkroll' style=\"list-style-image: url('##ICONURL##');\"><a href='##SITEURL##'>##SITENAME##</a></li>",
		afterEachLink: false,
		end:   '',
		replaceWithIconUrl: '##ICONURL##',
		replaceWithSiteUrl: '##SITEURL##',
		replaceWithSiteName: '##SITENAME##'
	}
};

function getIconUrl ( url ) {
	return iconForHost + urlPartsRegX.exec(url)[11];
}

function formatSite ( site, layout, opts ) {
	//allow for multiple json structures...
	var url = (typeof site.link==='string') ? site.link : site;
	var name = (typeof site.name==='string') ? site.name : (typeof site.link==='string') ? 	urlPartsRegX.exec(site.link)[11] : 	urlPartsRegX.exec(site)[11];
	
	var temp = layout.replace(opts.replaceWithIconUrl, getIconUrl(url));
		temp = temp.replace(opts.replaceWithSiteUrl, url);
		temp = temp.replace(opts.replaceWithSiteName, name);
	return temp;
}

/**
 * @constructor
 * @param {Object} opts - overrides of $.fn.linkroll.defaults
 */
function LinkRoll ( opts) {
	this.init(opts);
}

LinkRoll.prototype = {
	options: {},
	targetNode: null, 
	sourceUrl: null, 
	jsonModel: null, //hold reference to most recently loaded json object
	myWidget: null,
	init: function( overrides ) {
		this.options = $.extend({}, $.fn.linkroll.defaults, overrides);
		//ensure that selected method is supported
		this.options.method = ($.inArray(this.options.method, supportedMethods)) ? this.options.method : supportedMethods[0];
		if (this.options.jsonUrl) {
			this.sourceUrl = this.options.jsonUrl;
		};
		if (this.options.buttons===true) {//set all buttons to true
			this.options.buttons = {
				loadFromFile : true,
				loadFromUrl  : true,
				exportJson   : true,
				editJson     : true,
				reloadFromUrl: true
			};
		};
	},

	/**
	 * load data from url 
	 * @param {String} url - a json url
	 */
	loadFromJsonUrl: function ( url ) {
		this.updateSourceUrl( url );
		var that = this;
		$.getJSON( this.sourceUrl ).done( function ( data ) {
			that.buildFromJson( data );
		});
	},

	updateSourceUrl: function ( url ) {
		var temp = url;
		if ( this.options.useProxy ) {
			//prefix with proxy only if it has not already bee prefixed
			if ( url.indexOf( jsonProxy ) === -1) {
				temp = jsonProxy + url;
			};
		};
		this.sourceUrl = temp;
	},

	/**
	 * load the given data 
	 * @param {Object} jsonData - the data to load
	 */
	buildFromJson: function( jsonData ) {
		var template = this.options.jsonTemplate;
		var callback = this.options.onSuccess;
		this.jsonModel = jsonData;  //save json object to internal model
		var content = [];           //temp array to build a string
		content.push( template.begin );
		$.each(jsonData, function( index, value ) {
			content.push( template.beforeEachCategory + value.category + template.afterEachCategory );
			content.push( template.beforeLinks );
			$.each( value.links, function( index2, site ) {
				if ( template.beforeEachLink ) {
					content.push( formatSite( site, template.beforeEachLink, template ) );
				}
				if ( template.eachLink ) {
					content.push( formatSite( site, template.eachLink, template ) );
				}
				if ( template.afterEachLink ) {
					content.push( formatSite( site, template.afterEachLink, template ) );
				}
			});
			content.push( template.afterLinks );
		});
		content.push( template.end );
		this.targetNode.html( content.join("") );
		if ( this.options.addClass ) {
			this.targetNode.addClass( this.options.addClass );
		}
		if ($.isFunction( callback ) ) {
			callback( this.targetNode );
		}
	},

	/**
	 * insert an <img> into the DOM by a link using one of the supported insertion methods
	 * @param {Object} link - an <a> element selected by jQuery
	 */
	insertImage: function ( link ) {
		var href = $(link).attr('href');
		var url = getIconUrl( href );
		var img = $('<img />', {src: url});
		if ( this.options.addClass ) {
			img.addClass( this.options.addClass );
			link.addClass( this.options.addClass );
		}
		var insertionMethod = link[this.options.method];
		insertionMethod.call( link, img );
	},
	
	getWidget: function () {
		var hasButton = this.options.buttons;
		var widget = $('<div/>');
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
		
		}
		this.myWidget = widget;
		return widget;
	},
	
	popup: function ( url, title ) {
		if ( DialogApi ) {
			var t = (title) ? title : "LinkRoller";
			var h = window.innerHeight - 10;
			var w = window.innerWidth - 10;
			var iframe = $('<iframe height="'+(h-100)+'" width="'+(w-100)+'" frameborder="0" marginwidth="0" marginheight="0" src="' + url + '" />');
			var diag = $('<div id="mydialog" />');
			diag.append(iframe);
			var that = $(this.myWidget);
			that.append(diag);
			diag.dialog( { 
				title: t,
				modal: true,
				resizable: true,
				height: 'auto',
				width: w,
				close: function () {
					$('#mydialog').remove();
				}
			} );
		} else {
			var win = window.open( url, t );
			win.focus();
		}
	},
	
	LoadFromFileButton: function () {
		var span = $('<span/>');
		if ( FileApiSupported ) {
			var that = this;
			var input = $('<input />', { type: 'file', css: { visibility: 'hidden', width: 0, height: 0 } } );
			input.attr('accept', 'json');
			input.on('change', function( evt ) {
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
			    reader.readAsText(f, 'UTF-8');
			});
			var btn = $('<button/>', {type: 'button'});
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
		var span = $('<span/>');
		var input = $('<input />', {type: 'text'});
		var btn = $('<button/>', {type: 'button'});
		btn.html("load from url");
		btn.click( function () {
			that.loadFromJsonUrl( input.val() );
		});
		span.append( btn );
		span.append( input );
		return span;
	},
	
	EditButton: function() {
		var span = $('<span/>');
		if ( FileApiSupported ) {
			var that = this;
			var btn = $('<button/>', {type: 'button'} );
			btn.html('edit');
			btn.click(function() {
				var reEdit = ( that.sourceUrl && that.sourceUrl.indexOf( jsonEditorEndpoint ) > -1 ) ? true : false;
				if ( reEdit ) {
					var editorUrl = that.sourceUrl.replace( jsonEditorApi, '' );
					that.popup(editorUrl);
				} else {
					var jsonData = that.jsonModel;
					var jsonTxt = JSON.stringify(jsonData);
					$.ajax({
						url: jsonEditorEndpoint + jsonEditorApi,
						contentType: 'application/json; charset=utf-8',
						type: 'POST',
						data: jsonTxt,
						error: function (xhr, status) {
							alert(status);
						},
						success: function (data, status, xhr) {
							var location = xhr.getResponseHeader("location");
							that.sourceUrl = location;
							var editorUrl = location.replace(jsonEditorApi, '');
							that.popup(editorUrl);
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
		var span = $('<span/>');
		if (FileApiSupported) {
			var that = this;
			var btn = $('<button/>',{type: 'button'});
			btn.html('export');
			btn.click( function() {
				var data = that.jsonModel;
				var jsonTxt = JSON.stringify(data, null, ' ');
				var blob = new Blob ( [ jsonTxt ], { type: "application/json" } );
				that.popup(URL.createObjectURL(blob));
			});
			span.append( btn );
		} else {
			span.html( NotSupported );
		}
		return span;
	},
	
	ReloadButton: function() {
		var that = this;
		var btn = $('<button/>');
		btn.html('reload');
		btn.click( function () {
			that.loadFromJsonUrl( that.sourceUrl );
		});
		return btn;
	}
	
}; //end prototype

	

/**
 * TODO import from mozill bookmark json format 
 * 
 * Object {
 * 	type: text/x-moz-place-container,
 * 	title: '',
 * 	children: Array [ container / place ]
 *  root: ''
 * }
 * 
 * Object {
 	type: text/x-moz-place
 	title: ''
 	uri: url
 	iconuri: url
 	}
 * 
 * both object types: 
 * 	id
 * 	guid
 * 	index
 * 	dateAdded
 * 	lastModified
 * 	
 * 
 */
function mozillaImport(data) {
	
	
}


}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )


