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
*/

(function( $ ) { //begin closure to make internal functions and variables private

	//regex from http://jsperf.com/url-parsing/28
	var regx = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconAPI = '//www.google.com/s2/favicons?domain='; 
	var supportedMethods = ['append','prepend','before','after','html'];
	var NodeJitsuJsonP = 'https://jsonp.nodejitsu.com/?callback=?&url=';
	
	function getIconUrl ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	function buildFromJson ( jsonData, node, settings ) {
		var items = [];
		var template = settings.jsonTemplate;
		var callback = settings.onSuccess;
		items.push(template.begin);
		$.each(jsonData, function( index, value ) {
			items.push( template.beforeEachCategory + value.category + template.afterEachCategory);
			items.push(template.beforeLinks);
			$.each(value.links, function(index2, site) {
				if (template.beforeEachLink) {
					items.push(formatSite(site, template.beforeEachLink, template));
				}
				if (template.eachLink) {
					items.push(formatSite(site, template.eachLink, template));
				}
				if (template.afterEachLink) {
					items.push(formatSite(site, template.afterEachLink, template));
				}
			});
			items.push(template.afterLinks);
		});
		items.push(template.end);
		node.html(items.join(""));
		node.addClass(settings.addClass);
		if ($.isFunction(callback)) {
			callback(node);
		}
	}

	function loadFromJsonUrl (node, settings) {
		var url = (settings.useNodeJitsu) ? NodeJitsuJsonP + settings.json : settings.json;
		$.getJSON( url ).done( function(data) {
			buildFromJson(data, node, settings);
		});
	}

	
	function formatSite(site, layout, opts) {
		var url = (typeof site==='object') ? site.link : site;
		var name = (typeof site==='object') ? site.name : regx.exec(site)[11];
		var temp = layout.replace(opts.replaceWithIconUrl, getIconUrl(url));
			temp = temp.replace(opts.replaceWithSiteUrl, url);
			temp = temp.replace(opts.replaceWithSiteName, name);
		return temp;
	}
	
	/**
	 * add DOM chaining method to global jQuery object 
	 */
	$.fn.linkroll = function ( options ) {
//		var roller = new LinkRoller(options);
		var settings = $.extend({}, $.fn.linkroll.defaults, options);
		//ensure that selected method is supported
		settings.method = ($.inArray(settings.method, supportedMethods)) ? settings.method : supportedMethods[0];
		return this.each(function(){
			var node = $(this);
			if (settings.json) {
				loadFromJsonUrl(node, settings);
			} else {
				if (node.is('a')) {
					insertImage(node, settings);
				} else {
					node.find('a').each(function (){
						var subNode = $(this);
						insertImage(subNode, settings);
					});
				}
				if ($.isFunction(settings.onSuccess)) {
					settings.onSuccess(node);
				}
			}
			return this;
		});
	};

	function insertImage ( link, settings ) {
		var href = $(link).attr('href');
		var url = getIconUrl(href);
		var img = $('<img />', {src: url});
		img.addClass(settings.addClass);
		link.addClass(settings.addClass);
		var insertionMethod = link[settings.method];
		insertionMethod.call(link, img);
	}
	
	/**
	 * default configuration is globally accessible
	 */
	$.fn.linkroll.defaults = {
		addClass: 'linkroll',  //class name to add to all created/modified elements
		method: 'prepend',     //jQuery node insertion method for img tag
		json  : false,         //optinal url of json to be loaded
		useNodeJitsu: false,   //set true if json url is (trusted) remote host that does not enable CORS or JSONP
		onSuccess : false,     //optional callback function to apply additional formatting (useful when loading json async)
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
	
	/**
	 * return a 'read-only' copy of the supported insertion methods
	 */
	$.fn.linkroll.methods = function() {
		return 	supportedMethods.slice();
	};
	
	function LinkRoll ( opts ) {
		this.init(opts);
	}
	
	LinkRoll.prototype = {
		options: {},
		init: function(overrides) {
			this.options = $.extend({}, $.fn.linkroll.defaults, overrides);
		},
	};
	
	var FileObj = null;
	var JsonObj = null;

	//feature detection to see if all necessary HTML5 File APIs are supported.
	if (window.File && window.FileReader && window.FileList) {
		$.fn.linkroll.FileChooser = function (nodeToLoad, options) {
			var settings = $.extend({}, $.fn.linkroll.defaults, options);
			var input = $('<input />', {type: 'file', id: 'linkroll.input', name: 'linkroll.files[]'});
			//based on http://jsfiddle.net/8kUYj/234/
			input.on('change', function(evt) {
			    var files = evt.target.files; // FileList object
			    var f = files[0];
			    var reader = new FileReader(); //html5 object
			    reader.onload = (function (theFile) {
			        return function (e) { 
			            FileObj = e.target.result
			            JsonObj = JSON.parse(FileObj);
			            buildFromJson ( JsonObj, nodeToLoad, settings );
			        };
			    })(f);
			    reader.readAsText(f, 'UTF-8');
			});
			return input;
		};
	} else {
		$.fn.linkroll.FileChooser = function() {
			return false;
		};
		console.log('The File APIs are not fully supported in this browser.');
	}

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )