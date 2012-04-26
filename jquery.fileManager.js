/*
* File Manager
*
* Copyright (c) 2010 Tom Kay - oridan82@gmail.com
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.*
*
*/

;(function($){
	var optionDefaults = {
		path			: '',
		upload			: false,
		readonly		: false,
		fixedPath		: false,
		
		baseClass		: 'fmBase',
		folderClass		: 'fmFolder',
		trashClass		: 'fmTrash',
		loadingClass		: 'fmLoading',

		highlightClass		: 'ui-state-highlight',
		hoverClass		: 'ui-state-active'
	};

	$.fn.fileManager = function(settings, pluploadOptions) {
		var mbOptions = $.extend({}, optionDefaults, settings);
		if (!mbOptions.ajaxPath) {
			alert('ajaxPath not specified'); return;
		}
		if (mbOptions.fixedPath) mbOptions.path = mbOptions.fixedPath;

		pluploadOptions = $.extend({url:mbOptions.ajaxPath,runtimes:'html5,html4'}, pluploadOptions);

		var query = $.extend({},{path:mbOptions.path},mbOptions.get);
		this.each(function () { // swap with getJSON so not duplicating ajax
			var $sel = $(this);
			$.ajax({url:mbOptions.ajaxPath,dataType:'json',type:'POST',data:query,success:function(data, status) {
				if (!data) {
					$sel.append('No data received. Please ensure ProcessAjax is called in your ajax script.');
					return;
				}
				$sel.data('result',data);
				$sel.data('options',mbOptions);
				if (status != "success") {
					var msg = "Sorry but there was an error: "+status;
				}
				// process response
				$sel.empty();

				if (!mbOptions.readonly) {
					$sel.append('<div>Path: '+data.rootPath+data.path+'</div>');
					if (data.path && !mbOptions.fixedPath) DrawItem($sel,{path:'..',title:'..',type:1});
					DrawItem($sel,{path:'',title:'',type:2});
				}
				if ($(data.files).length == 0) {
				  $sel.append('<div style="font-size:1.3em;padding:0.5em">No files in this folder.</div>');
				}
				$(data.files).each(function () {
					DrawItem($sel,this);
				});
				$sel.append('<div style="clear:both"></div>');
				if (!mbOptions.readonly)
					$sel.append($('<div>New Folder</div>').button().bind('click',NewFolder));
				if (mbOptions.upload) {
					var ul = $('<div></div>').hide();
					$sel.append($('<div>Upload Files</div>').button().bind('click',{container:ul},UploadFiles));
					$sel.append(ul);
				}
				
				// end processing
				
				$('.'+mbOptions.baseClass,$sel).disableSelection();//bind('selectstart',function () { return false; });
				$('.'+mbOptions.folderClass,$sel).bind('dblclick',ItemDblClick);
			}});

			function UploadFiles(event) {
				$(event.data.container).toggle();
				if (plupload) {
					var opts = pluploadOptions;
					opts.init = $.extend({},opts.init,{FileUploaded:function (uploader,file,response) { if (uploader.total.queued == 0) RefreshView($sel); }});
					opts.multipart_params = { 'path' : $sel.data('result').path };

					$(event.data.container).plupload(opts);
				} else {
					$(event.data.container).html('Must install Plupload.');
				}
			}
			function NewFolder() {
				var path = prompt('Enter Folder Name:');
				if (!path) return;
				if ($sel.data('result').path) path = $sel.data('result').path + '/' + path;
				ReloadFolder($sel, path);
			}
		});


		function FileDropped(event,ui) {
			var from = $(ui.draggable);
			var to = $(this);

			if ($(this).hasClass(mbOptions.trashClass)) {
				if (confirm('Really delete "'+from.data('item').title+'"?  This cannot be undone')) {
					ajaxData = {path:mbOptions.path,'delete':from.data('item').path};
					$.ajax({url:mbOptions.ajaxPath,data:ajaxData,type:'POST',dataType:'script',complete:function() {
						RefreshView(from.data('item').target);
					}});
				}
			} else {
				return Rename(from.data('item').target,from.data('item').path,to.data('item').path+'/'+from.data('item').path);
			}
		};
		function Rename(view,from,to) {
			ajaxData = {path:mbOptions.path,mFrom:from,mTo:to};
			$.ajax({url:mbOptions.ajaxPath,data:ajaxData,type:'POST',dataType:'script',complete:function() {
				RefreshView(view);
			}});
		}
		function ItemDblClick() {
			var item = $(this).data('item');
			if (item.type != ICONTYPE_FOLDER) return;
			var path = item.path;
			if (item.target.data('result').path) path = item.target.data('result').path + '/' + path;
			ReloadFolder(item.target,path);
		}
		function RefreshView(target) {
			ReloadFolder(target,target.data('result').path);
		}
		function ReloadFolder(target,path) {
			target.fileManager($.extend({},mbOptions,{path:path}),pluploadOptions);
		};

		var ICONTYPE_FILE = 0;
		var ICONTYPE_FOLDER = 1;
		var ICONTYPE_TRASH = 2;
		function DrawItem(target, item) {
			if (item.type == ICONTYPE_FOLDER && mbOptions.fixedPath) return;
			
			item.target = $(target);
			item.fullPath = item.target.data('result').rootPath + item.target.data('result').path + '/' + item.path;
			var icon = $('<div title="'+item.title+'"></div>');
			icon.data('item',item);
			icon.addClass(mbOptions.baseClass);

			// set classes
			if (item.type == ICONTYPE_FOLDER)
				icon.addClass(mbOptions.folderClass);
			else if (item.type == ICONTYPE_TRASH)
				icon.addClass(mbOptions.trashClass);
			
			// set draggables
			if (!mbOptions.readonly) {
				if (item.type == ICONTYPE_FOLDER || item.type == ICONTYPE_TRASH)
					icon.droppable({tolerance:'intersect',accept:'.'+mbOptions.baseClass,drop:FileDropped,hoverClass:mbOptions.hoverClass,activeClass:mbOptions.highlightClass});
				if (item.type != ICONTYPE_TRASH && item.path != '..')
					icon.draggable({stack:'files',revert:true,zIndex:1000,opacity:0.5,scroll:false});
			}
			
			if (item.type == ICONTYPE_FILE && item.path.search(/.jpeg|.jpg|.png|.gif|.tif|.tiff/i) > -1) {
				icon.css('background-image','none');
				var iconPath = (item.icon) ? item.icon : item.fullPath;
				icon.append('<img style="width:100%;height:100%" src="'+iconPath+'">');
			}
			
			// events
			if (mbOptions.events) {
				$.each(mbOptions.events,function (index,value) {
					icon.bind(index, value);
				});
			}
			icon.data('result',target.data('result'));
			
			target.append(icon);
			if (!item.path) return;

			//if (mbOptions.readonly) return;
				
			var ext = item.path.match(/\.[^.\b]*$/i);
			if (ext) ext = ext[0];
			else ext = '';
			var basename = item.path.replace(ext,'');

			var renamebox = $('<input style="position:absolute;left:-1em;bottom:-1px;right:-1em" type="text">')
				.bind('focus',function() { $(this).val(basename); })
				.bind('blur',function() { $(this).hide(); if (item.path == $(this).val()+ext) return; Rename(item.target,item.path,$(this).val()+ext); })
				.bind('keydown',function(event) { if (event.keyCode == '13' || event.keyCode == '27') $(this).blur(); })
				.hide()
				.appendTo(icon);
			var label = $('<div class="label">'+item.title+'</div>')
				.prependTo(icon)//.bind('dblclick',function() {return false;})
				.bind('click',function () {
					if (!mbOptions.readonly) {
						renamebox.show().focus();
						return false;
					}
				});
		}
		
		return $(this);
	};
})(jQuery);
