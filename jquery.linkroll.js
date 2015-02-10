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

	var regx = /^(((([^:\/#\?]+:)?(?:(\/\/)((?:(([^:@\/#\?]+)(?:\:([^:@\/#\?]+))?)@)?(([^:\/#\?\]\[]+|\[[^\/\]@#?]+\])(?:\:([0-9]+))?))?)?)?((\/?(?:[^\/\?#]+\/+)*)([^\?#]*)))?(\?[^#]+)?)(#.*)?/;
	var iconAPI = '//www.google.com/s2/favicons?domain='; 
	var supportedMethods = ['append','prepend','before','after','html'];
	var NodeJitsuJsonP = 'https://jsonp.nodejitsu.com/?callback=?&url=';
	
	function getIconUrl ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	function buildFromJson ( node, settings ) {
		var url = (settings.useNodeJitsu) ? NodeJitsuJsonP + settings.json : settings.json;
		var callback = settings.onSuccess;
		$.getJSON( url ).done( function(data) {
			var items = [];
			var template = settings.jsonTemplate;
			items.push(template.begin);
			$.each(data, function( index, value ) {
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
		});
	}
	
	function formatSite(site, layout, opts) {
		var temp = layout.replace(opts.replaceWithIconUrl, getIconUrl(site.link));
			temp = temp.replace(opts.replaceWithSiteUrl, site.link);
			temp = temp.replace(opts.replaceWithSiteName, site.name);
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
				buildFromJson(node, settings);
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
	}
	
	function LinkRoll ( opts ) {
		this.init(opts);
	};
	
	LinkRoll.prototype = {
		options: {},
		init: function(overrides) {
			this.options = $.extend({}, $.fn.linkroll.defaults, overrides);
		},
	};
	

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )