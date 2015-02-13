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
	var urlPartsRegX       = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconForUrl         = '//www.google.com/s2/favicons?domain_url='; 
	var iconForHost        = '//www.google.com/s2/favicons?domain='; 
	var supportedMethods   = ['append','prepend','before','after','html'];
	var jsonProxy          = 'https://jsonp.nodejitsu.com/?callback=?&url=';
	var jsonEditorEndpoint = 'https://jsonblob.com';
	var jsonEditorApi      = '/api/jsonBlob';
	var	FileApiSupported   = window.File && window.FileReader && window.FileList;
	
	/** private internal variables */
	var asyncHelper        = null;
	
	
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
			if (roller.options.buttons && roller.options.buttons.loadFromFile) {
				node.append(roller.LoadFromFileButton());
			}
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
		if (this.options.jsonUrl) {
			this.sourceUrl = this.options.jsonUrl;
		}
	}
	
	LinkRoll.prototype = {
		options: {},
		targetNode: null, 
		sourceUrl: null, 
		jsonModel: null, //hold reference to most recently loaded json object
		init: function(overrides) {
			this.options = $.extend({}, $.fn.linkroll.defaults, overrides);
			//ensure that selected method is supported
			this.options.method = ($.inArray(this.options.method, supportedMethods)) ? this.options.method : supportedMethods[0];
		},
		enableButtons: function ( ) {
			this.options.buttons = {
				loadFromFile : true,
				loadFromUrl  : true,
				exportJson   : true,
				editJson     : true,
				reloadFromUrl: true
			};
		},
		disableButtons: function ( ) {
			this.options.buttons = false;
		},
	
		/**
		 * load data from url 
		 * @param {String} url - a json url
		 */
		loadFromJsonUrl: function ( url ) {
			this.sourceUrl = (this.options.useProxy) ? jsonProxy + url : url;
			asyncHelper = this;
			$.getJSON( this.sourceUrl ).done( function ( data ) {
				asyncHelper.buildFromJson(data);
			});
		},

		buildFromJson: function  ( jsonData ) {
			var template = this.options.jsonTemplate;
			var callback = this.options.onSuccess;
			this.jsonModel = jsonData;  //save json object to internal model
			var content = [];           //temp array to build a string
			content.push(template.begin);
			$.each(jsonData, function( index, value ) {
				content.push( template.beforeEachCategory + value.category + template.afterEachCategory);
				content.push(template.beforeLinks);
				$.each(value.links, function(index2, site) {
					if (template.beforeEachLink) {
						content.push(formatSite(site, template.beforeEachLink, template));
					}
					if (template.eachLink) {
						content.push(formatSite(site, template.eachLink, template));
					}
					if (template.afterEachLink) {
						content.push(formatSite(site, template.afterEachLink, template));
					}
				});
				content.push(template.afterLinks);
			});
			content.push(template.end);
			this.targetNode.html(content.join(""));
			if (this.options.addClass) {
				this.targetNode.addClass(this.options.addClass);
			}
			if ($.isFunction(callback)) {
				callback(this.targetNode);
			}
		},

		/**
		 * insert an <img> into the DOM by a link using one of the supported insertion methods
		 * @param {Object} link - an <a> element selected by jQuery
		 */
		insertImage: function ( link ) {
			var href = $(link).attr('href');
			var url = getIconUrl(href);
			var img = $('<img />', {src: url});
			if (this.options.addClass) {
				img.addClass(this.options.addClass);
				link.addClass(this.options.addClass);
			}
			var insertionMethod = link[this.options.method];
			insertionMethod.call(link, img);
		},
		
		LoadFromFileButton: function () {
			var span = $('<span/>');
			if (FileApiSupported) {
				asyncHelper = this;
				var input = $('<input />', {type: 'file', css: {visibility: 'hidden', width: 0, height: 0}});
				input.attr('accept', 'json');
				input.on('change', function(evt) {
				    var files = evt.target.files;  // HTML5 FileList
				    var f = files[0];              // HTML5 File
				    var reader = new FileReader(); // HTML5 FileReader
				    reader.onload = (function (theFile) {
				        return function (e) { 
				            var fileObj = e.target.result;
				            var data = JSON.parse(fileObj);
				            asyncHelper.buildFromJson ( data );
				        };
				    })(f);
				    reader.readAsText(f, 'UTF-8');
				});
				var btn = $('<button/>', {type: 'button'});
				btn.html("load from file");
				btn.click( function () {
					input.click();
				});
				span.append(btn);
				span.append(input);
			} else {
				span.html("File API is not supported");
			}
			return span;
		},
		
		
	};
	

	if (true) {
		$.fn.linkroll.EditButton = function (link, options) {
			var btn = $('<button/>',{type: 'submit', formmethod: 'GET', formtarget: '_blank'});
			btn.html('edit');
			btn.click(function() {
				var jsonData = JsonObj;
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
						console.log(data);
						console.log(status);
						console.log(xhr);
						var location = xhr.getResponseHeader("location"); //
						var editor = location.replace(jsonEditorApi, '');
						window.open(editor);
						btn.after(reloadButton(location));
					}
				});
			});
			return btn;
		};
	} else {
		console.log('The File APIs are not fully supported in this browser.');
	}

	/**
	 * get a button to reload content from the given url
	 */
	function reloadButton ( url ) {
		var btn = $('<button/>');
		btn.html('reload');
		btn.click( function () {
			alert(url)
		});
		return btn;
	}

	if (true) {
	$.fn.linkroll.ExportButton = function (link, options) {
		var btn = $('<button/>',{type: 'submit', formmethod: 'GET', formtarget: '_blank'});
		btn.html('export');
		btn.click(function() {
			var data = JsonObj;
			var jsonTxt = JSON.stringify(data);
			var blob = new Blob([jsonTxt], {type: "application/json"});
			//btn.formaction = URL.createObjectURL(blob);
			var tmp = $('<form/>', {
				method: 'GET', 
				target: "_blank",
				action: URL.createObjectURL(blob)
			});
			$("body").append(tmp);
			tmp.submit();
			tmp.remove();
		});
		return btn;
		}
	} else {
		console.log('The File APIs are not fully supported in this browser.');
	}

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )