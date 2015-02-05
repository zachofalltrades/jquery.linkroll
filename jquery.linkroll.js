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
	
	function getIconUrl ( url ) {
		return iconAPI + regx.exec(url)[11];
	}

	function buildFromJson ( node, settings ) {
		var url = settings.json;
		var callback = settings.onSuccess;
		$.getJSON( url, function(data) {
			var items = [];
			$.each(data, function( index, value ) {
				items.push("<h3 class='linkroll'>" + value.category + "</h3><div class='linkroll'><ul class='linkroll'>");
				$.each(value.links, function(index2, site) {
					items.push("<li class='linkroll' style=\"list-style-image: url('"
							+ getIconUrl(site.link)
							+ "');\"><a href='" + site.link + "'>" + site.name
							+ "</a></li>");
				});
				items.push("</ul></div>");
			});
			node.html(items.join(""));
			node.addClass(settings.addClass);
			if ($.isFunction(callback)) {
				callback(node);
			}
		});
	}
	
	
	
	/**
	 * add DOM chaining method to global jQuery object 
	 */
	$.fn.linkroll = function ( options ) {
//		var roller = new LinkRoller(options);
		var settings = $.extend({}, $.fn.linkroll.defaults, options);
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
		onSuccess : false      //optional callback function to apply additional formatting (useful when loading json async)
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
			this.options = $.extend({}, $.fn.format.defaults, overrides);
		},
	};
	

}(jQuery)); //end of IIFE (see http://benalman.com/news/2010/11/immediately-invoked-function-expression/ )