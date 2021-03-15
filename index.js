// Date shim
if (!Date.now) {
	Date.now = function () {
		return new Date().getTime();
	};
}

// Trim shim
if (typeof(String.prototype.trim) === 'undefined') {
	String.prototype.trim = function() {
		return String(this).replace(/^\s+|\s+$/g, '');
	};
}

// Auxiliary functions

function array_move(arr, old_index, new_index) {
	if (new_index >= arr.length) {
		let k = new_index - arr.length + 1;
		while (k--)
			arr.push(undefined);
	}
	arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
};

window.is_number = function (o) {
	return typeof o === 'number' && o === o && o !== Infinity && o !== -Infinity;
};

window.is_node = function (o) {
	// Returns true if DOM node
	return typeof Node === "object"
		? o instanceof document.Node
		: o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName === "string";
};

window.is_element = function (o) {
	// Returns true if DOM element
	return typeof HTMLElement === "object"
		? o instanceof document.HTMLElement
		: o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName === "string";
};

window.is_node_or_element = function (o) {
	// Returns true if DOM node or element
	return window.is_node(o) || window.is_element(o);
};

window.is_iterable = function (o) {
	// Returns true if iterable
	if (o == null)
		return false;
	return typeof o[Symbol.iterator] === 'function';
};

let alert_timeout = null;

function alert_copy() {
	clearTimeout(alert_timeout);
	$('.alert').addClass('drop_alert');
	alert_timeout = setTimeout(function () {
		$('.drop_alert').removeClass('drop_alert');
	}, 2500);
}

function fallback_copy_to_clipboard(text) {
	const text_area = document.createElement('text_area');
	text_area.value = text;
	text_area.style.top = '0';
	text_area.style.left = '0';
	text_area.style.position = 'fixed';
	document.body.appendChild(text_area);
	text_area.focus();
	text_area.select();
	try {
		document.execCommand('copy');
		alert_copy();
	}
	catch (e) {
		console.error('Failed to copy to clipboard', e);
	}
	document.body.removeChild(text_area);
}

function copy_to_clipboard(text) {
	if (!navigator.clipboard) {
		fallback_copy_to_clipboard(text);
		return;
	}
	navigator.clipboard.writeText(text).then(function() {
		alert_copy();
	}, function(e) {
		console.error('Failed to copy to clipboard', e);
	});
}

function num_leading_whitespace(text) {
	let count = 0;
	let index = 0;
	while (text.charAt(index) === '\t' || text.charAt(index) === ' ') {
		count++;
		index++;
	}
	return count;
}

function props(obj) {
	let keys = [];
	let properties = {};
	for (; obj !== null; obj = Object.getPrototypeOf(obj)) {
		let op = Object.getOwnPropertyNames(obj);
		for (let i = 0; i < op.length; i++) {
			let key = op[i];
			if (keys.includes(key) || key === '__proto__')
				continue;
			try {
				obj[key];
			} catch (e) {
				continue;
			}
			keys.push(key);
			properties[key] = window.js_beautify(String(obj[key]), {'preserve_newlines': false,});
		}
	}

	let ordered_lines = [];
	for (let key of keys) {
		let lines = String(properties[key]).split(/\r\n|\r|\n/);
		let value = '[\n\t<script>\n';
		let n_whitespace = num_leading_whitespace(lines[lines.length-1]);
		for (let i in lines) {
			let line = lines[i];
			if (num_leading_whitespace(line) >= n_whitespace)
				line = line.substring(n_whitespace, line.length);
			value += '\t' + line + '\n';
		}
		value += '\t</script>\n]';
		ordered_lines.push('"' + key + '": ' + value);
	}
	return ordered_lines;
}

function array_to_json(args_array) {
	let res = [];
	if (window.is_iterable(args_array)) {
		for (let arg of args_array) {
			let elem = {
				data: arg,
				type: typeof arg,
				name: arg && arg.constructor ? arg.constructor.name : null,
				properties: null,
			};

			if (window.is_element(arg)) {
				// HTML as string
				elem.data = window.html_beautify(arg.outerHTML);
			}
			else if (elem.type === 'function') {
				// Functions as string
				elem.data = '<script>\n' + window.js_beautify(String(arg), {'preserve_newlines': false,}) + '\n</script>';
			}
			else if (elem.type === 'object') {
				if (elem.data === null) {
					// Null is an object
					elem.data = 'null';
				}
				else if (Array.isArray(arg)) {
					// Arrays as string
					let json_arr = '';
					if (arg.length > 1e4) {
						json_arr = 'Too many to print.';
					}
					else {
						try {
							json_arr = JSON.stringify(arg, null, '\t');
						}
						catch (error) {
							json_arr = 'Failed to print: Out-of-memory.';
						}
					}
					elem.data = 'Array(' + arg.length + ') ' + json_arr;
				}
				else {
					// Objects as string
					elem.data = elem.name ? elem.name : 'type ' + elem.type;
					elem.data += ' ';
					if (window.is_iterable(arg)) {
						elem.data += '{\n';
						for (let arg_elem of arg)
							elem.data += arg_elem + '\n';
						elem.data += '}';
					}
					let json_str;
					try {
						json_str = JSON.stringify(arg, null, '\t');
					}
					catch (e) {
						json_str = '{}';
					}
					// Stringified string should have brackets
					if (!json_str.includes('{') || !json_str.includes('}')) {
						elem.data += json_str;
					}
					else {
						elem.data += json_str.substring(0, json_str.length - 1);
						// Add newline for empty objects
						if (elem.data.charAt(elem.data.length-1) === '{')
							elem.data += '\n';
						// Add properties
						let lines = props(arg);
						elem.data += '\t"__proto__": {\n';
						for (let line of lines) {
							let plines = line.split(/\r\n|\r|\n/);
							for (let pline of plines)
								elem.data += '\t\t' + pline + '\n';
						}
						elem.data += '\t}\n';
						elem.data += '}';
					}
				}
			}
			else {
				elem.data = String(arg);
			}
			res.push(elem);
		}
	}
	return res;
}

function number_with_commas(number) {
	return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function $in_scroll_view($container, $elem, partial=true) {
	const container_height = $container.height();
	const elem_top = $elem.offset().top - $container.offset().top;
	const elem_bot = elem_top + $elem.height();
	const is_total = (elem_top >= 0 && elem_bot <= container_height);
	const is_partial = ((elem_top < 0 && elem_bot > 0 ) || (elem_top > 0 && elem_top <= container_height)) && partial;
	return  is_total || is_partial;
}

// Interpolation

function lerp(a, b, i) {
	return (1-i)*a + i*b;
}

function cerp(a, b, i) {
	const mu = (1 - Math.cos(i*Math.PI))/2;
	return (a*(1-mu)) + (b*mu);
}

// Datetime

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function utc_now() {
	return to_utc(new Date());
}

function to_utc(date) {
	// const d = new Date();
	// const utc =  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
	const utc = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
	return new Date(utc);
}

function datetime_to_months(dt) {
	let mo = dt.getMonth()+1;
	if (mo < 10)
		mo = '0'+mo;
	return dt.getFullYear()+'-'+mo;
}

function datetime_to_string(dt, is_date=false) {
	let mo = dt.getMonth()+1;
	if (mo < 10)
		mo = '0'+mo;
	let day = dt.getDate();
	if (day < 10)
		day = '0'+day;
	let str = dt.getFullYear()+'-'+mo+'-'+day;
	if (!is_date)
		str += ' '+dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds();
	return str;
}

function parse_datetime(dt, is_date=false) {
	if (dt instanceof Date)
		dt = dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate()+' '+dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds();
	const t = dt.split(/[- :T.]/);
	if (is_date)
		return new Date(Date.UTC(t[0], t[1]-1, t[2]));
	return new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]));
}

Date.prototype.add_days = function(days) {
	const date = new Date(this.valueOf());
	date.setDate(date.getDate() + days);
	return date;
};

function get_range(start, end, reversed=false, leap=1) {
	if (!start instanceof Date)
		start = parse_datetime(start);
	if (!end instanceof Date)
		end = parse_datetime(end);
	else
		end = to_utc(end.add_days(-1));

	const dates = [];
	// let current_date = start.add_days(1);
	let current_date = to_utc(start.add_days(-1));
	end = to_utc(end);
	while (current_date < end) {
		dates.push(new Date(current_date));
		current_date = current_date.add_days(leap);
	}
	if (reversed)
		return dates.reverse();
	return dates;
}

function date_leq(a, b) {
	return a.getFullYear() <= b.getFullYear() || a.getMonth() <= b.getMonth() || a.getDate() <= b.getDate();
}

function date_geq(a, b) {
	return a.getFullYear() >= b.getFullYear() || a.getMonth() >= b.getMonth() || a.getDate() >= b.getDate();
}

function date_eq(a, b) {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Events

// const start_update_event = new Event('start_update');
// const update_event = new Event('update');
const request_update_event = new Event('request_update');
const resized_event = new Event('resized');
let is_querying = false;

// Data

const colors = [
	'rgb(57, 59, 121)',
	'rgb(107, 110, 207)',
	'rgb(156, 158, 222)',
	'rgb(231, 186, 82)',
	'rgb(189, 158, 57)',
	'rgb(140, 109, 49)',
	'rgb(206, 219, 156)',
	'rgb(148, 119, 63)',
	'rgb(181, 207, 107)',
	'rgb(222, 158, 214)',
	'rgb(173, 73, 74)',
	'rgb(165, 81, 148)',
	'rgb(123, 65, 115)',
	'rgb(214, 97, 107)',

	// '#00C0C7',
	// '#5144D3',
	// '#E8871A',
	// '#DA3490',
	// '#9089FA',
	// '#47E26F',
	// '#2780EB',
	// '#6F38B1',
	// '#DFBF03',
	// '#CB6F10',
	// '#268D6C',
	// '#9BEC54',
];
const n_rows = 200;
const default_symbol = 'GME';
const default_table = `Reddit_${default_symbol}`;

function reset_dataset() {
	dataset.tables = [];
	dataset.table = default_table;
	dataset.data = [];
	dataset.page = 1;
	dataset.orders = [];
	dataset.is_custom_cmd = false;
}

let $loading1 = null;
let $loading2 = null;

let $table = null;
let dataset = null;
let table = null;
let editor = null;
// let words = null;
let chart = null;

// Database

function get_estimate() {
	const req = $.ajax({
		'url': '/project/social_stock/estimate',
		'type': 'post',
	});
	return new Promise(function (resolve, reject) {
		req.done(function (res) {
			resolve(res);
		});
	});
}

function execute(cmd) {
	const req = $.ajax({
		'url': '/project/social_stock/execute',
		'type': 'post',
		'data': {'cmd': cmd},
	});
	return new Promise(function (resolve, reject) {
		req.done(function (res) {
			resolve(res);
		});
	});
}

// Worker

let worker;

// Story

// let is_started = false;
let is_paused = true;

// Class

class Vector {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	scale(s) {
		return new Vector(this.x * s, this.y * s);
	}

	add(v) {
		return new Vector(this.x + v.x, this.y + v.y);
	}

	sub(v) {
		return new Vector(this.x - v.x, this.y - v.y);
	}

	mul(v) {
		return new Vector(this.x * v.x, this.y * v.y);
	}

	div(v) {
		return new Vector(this.x / v.x, this.y / v.y);
	}

	length() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	}
}

class Table {
	constructor() {
		const self = this;
		// self.$table = $('#data_table');
		self.$pages = $('.page_buttons');
		self.$select = $('#table_select');
		self.$type_select = $('#table_type_select');
		self.$container = $('#data_table_container');

		self.$rows = [];
		self.rows = [];
		self.keys = [];
		self.$view_rows = [];
		self.view_rows = [];

		self.cell_timer = null;
		self.$container.on('scroll', function (e) {
			// console.log(e);
			clearTimeout(self.cell_timer);
			self.cell_timer = setTimeout(function () {
				self.$view_rows = [];
				self.view_rows = [];
				let is_found = false;
				for (const i in self.$rows) {
					const $row = self.$rows[i]['$row'];
					const row = self.rows[i];
					if ($in_scroll_view(self.$container, $row)) {
						is_found = true;
						self.$view_rows.push(self.$rows[i]);
						self.view_rows.push(row);
					}
					else if (is_found) {
						break;
					}
				}
				worker.postMessage({
					'name': 'scroll',
					'fn': 'stats',
					'args': self.view_rows,
				});
			}, 40);
		});

		self.$prev_page_button = $('#prev_page');
		self.$next_page_button = $('#next_page');
		self.$first_page_button = $('#first_page');
		self.$last_page_button = $('#last_page');

		self.$num_tables = $('.num_tables');
		self.$num_rows = $('.num_rows');
		self.$db_size = $('.db_size');

		self.preferred_order = [
			'datetime',
			'update_datetime',
			'reddit_url',
			'twitter_url',
			'body',
			'full_text',
			'sa_roberta_entailment',
			'sa_roberta_contradiction',
			'sa_roberta_neutral',
			'score',
			'subreddit',
			'favorite_count',
			'retweet_count',
			'reply_count',
			'user_followers_count',
			'user_normal_followers_count',
			'user_friends_count',
			'user_listed_count',
			'user_statuses_count',
			'user_favourites_count',
			// 'tb_polarity',
			// 'tb_subjectivity',
		];
		self.preferred_order = self.preferred_order.reverse();

		// window.addEventListener('update', function () {
		// 	if (dataset.result.status == 'success')
		// 		self.update();
		// }, false);
	}

	create_page_buttons() {
		const self = this;
		self.$pages.empty();
		self.$prev_page_button.off('click').hide();
		self.$next_page_button.off('click').hide();
		self.$first_page_button.off('click').hide();
		self.$last_page_button.off('click').hide();

		let n_pages = Math.ceil(dataset.count/n_rows);
		if (dataset.is_custom_cmd)
			n_pages = 1;
		let low = Math.max(dataset.page-2, 1);
		const high = Math.min(low+4, n_pages);
		low = Math.max(Math.min(high-4, low), 1);
		for (let i = low; i <= high; i++) {
			const $button = $('<div>')
				.appendTo(self.$pages)
				.text(i);
			if (i == dataset.page)
				$button.addClass('selected_page_number');
			$button.on('click', function () {
				if (dataset.page == i)
					return;
				dataset.page = i;

				$('.selected_page_number').removeClass('selected_page_number');
				$button.addBack('selected_page_number');
				window.dispatchEvent(request_update_event);
			});
		}

		self.$prev_page_button.show();
		self.$next_page_button.show();
		self.$first_page_button.show();
		self.$last_page_button.show();
		self.$next_page_button.on('click', function () {
			dataset.page += 1;
			if (dataset.page > n_pages)
				dataset.page = n_pages;
			else
				window.dispatchEvent(request_update_event);
		});
		self.$prev_page_button.on('click', function () {
			dataset.page -= 1;
			if (dataset.page < 1)
				dataset.page = 1;
			else
				window.dispatchEvent(request_update_event);
		});
		self.$first_page_button.on('click', function () {
			if (dataset.page == 1)
				return;
			dataset.page = 1;
			window.dispatchEvent(request_update_event);
		});
		self.$last_page_button.on('click', function () {
			if (dataset.page == n_pages)
				return;
			dataset.page = n_pages;
			window.dispatchEvent(request_update_event);
		});
	}

	create_select_options() {
		const self = this;
		self.$select.empty();
		const $options = [];
		for (const table_name of dataset.tables) {
			const $option = $('<option>')
				.appendTo(self.$select)
				.val(table_name)
				.text(table_name);
			if (table_name == dataset.table)
				$option.prop('selected', true);
			$options.push($option);
		}
		self.$select.off('change');
		self.$select.on('change', function () {
			reset_dataset();
			dataset.table = self.$select.val();
			window.dispatchEvent(request_update_event);
		});

		function filter_options(update=true) {
			const val = self.$type_select.val();
			if (val == null)
				return;

			if (val == 'All') {
				for (const $op of $options)
					$op.show();
			}
			else if (val == 'Symbols' && update) {
				reset_dataset();
				dataset.table = 'All_Symbols';
				window.dispatchEvent(request_update_event);
			}
			else {
				if (!dataset.table.includes(val))
					self.$select.val('');
				else
					self.$select.val(dataset.table);
				for (const $op of $options) {
					if (!$op.val().includes(val))
						$op.hide();
					else
						$op.show();
				}
			}
		}
		filter_options(false);

		self.$type_select.off('change');
		self.$type_select.on('change', filter_options);
	}

	update() {
		const self = this;
		self.create_page_buttons();
		self.create_select_options();

		// self.$num_tables.text(number_with_commas(dataset.tables.length)).addClass('changed');
		self.$num_rows.text(number_with_commas(dataset.count_all)).addClass('changed');
		self.$db_size.text(number_with_commas((dataset.size/1024/1024/1024).toFixed(2))).addClass('changed');
		clearTimeout(self.fadein_remove_timer);
		self.fadein_remove_timer = setTimeout(function () {
			self.$num_tables.removeClass('changed');
			self.$num_rows.removeClass('changed');
		}, 2000);

		self.render();
	}

	sorted_keys(data) {
		const self = this;
		if (dataset.data == null || dataset.data.length == 0)
			return [];
		const sorted_keys = Object.keys(dataset.data[0]);
		if (self.is_reddit_data(dataset.data[0]))
			sorted_keys.push('reddit_url');
		else if (self.is_twitter_data(dataset.data[0]))
			sorted_keys.push('twitter_url');
		for (const k of self.preferred_order)
			if (sorted_keys.includes(k))
				array_move(sorted_keys, sorted_keys.indexOf(k), 0);
		return sorted_keys;
	}

	is_twitter_data(data) {
		return data.hasOwnProperty('user_screen_name') && data.hasOwnProperty('conversation_id');
	}

	is_reddit_data(data) {
		return data.hasOwnProperty('subreddit') && data.hasOwnProperty('link_id') && data.hasOwnProperty('id');
	}

	get_style(row, k, stats) {
		const pos_color = 'rgba(55, 184, 233, 0.3)';
		const neg_color = 'rgba(240, 105, 80, 0.3)';
		const date_color = 'rgba(105, 240, 80, 0.3)';
		const empty_color = 'rgba(0, 0, 0, 0)';
		// const other_color = 'rgba(253, 251, 225, 0.5)';
		const other_color = 'rgba(150, 150, 150, 0.1)';
		if (!stats['comparable'].hasOwnProperty(k))
			return {'background-color': empty_color};

		let background;
		// let width;
		if (stats['comparable'][k]) {
			const max = stats['max'][k];
			const min = stats['min'][k];

			let num = Number(row[k]);
			if (isNaN(num))
				num = Date.parse(row[k]);

			if (min < 0 && max > 0) {
				// Find one with greater distance away from zero
				const abs_max = Math.max(Math.abs(min), Math.abs(max));
				// Use min or max as range
				let p = Math.floor(Math.abs(num)/abs_max*100);
				if (isNaN(p))
					p = 0;
				if (stats['date'][k])
					background = 'linear-gradient(90deg,'+date_color+p+'%,'+empty_color+p+'%)';
				else if (num < 0)
					background = 'linear-gradient(90deg,'+neg_color+p+'%,'+empty_color+p+'%)';
					// background = neg_color;
				else
					background = 'linear-gradient(90deg,'+pos_color+p+'%,'+empty_color+p+'%)';
					// background = pos_color;
				// width = p;
			}
			else {
				const abs_min = Math.min(Math.abs(min), Math.abs(max));
				const abs_max = Math.max(Math.abs(min), Math.abs(max));
				let p = Math.floor((Math.abs(num)-abs_min)/(abs_max-abs_min)*100);
				if (isNaN(p))
					p = 0;

				if (stats['date'][k])
					background = 'linear-gradient(90deg,'+date_color+p+'%,'+empty_color+p+'%)';
				else if (num < 0)
					background = 'linear-gradient(90deg,'+neg_color+p+'%,'+empty_color+p+'%)';
					// background = neg_color;
				else
					background = 'linear-gradient(90deg,'+pos_color+p+'%,'+empty_color+p+'%)';
					// background = pos_color;
				// width = p;
			}
		}
		else {
			background = other_color;
		}
		return {
			'background': background,
		};
	}

	render() {
		const self = this;
		$table.empty();
		self.$rows = [];
		self.rows = [];
		self.$view_rows = [];
		self.view_rows = [];
		self.keys = self.sorted_keys(dataset.data);
		if (dataset.data.length == 0)
			return;

		const $thead = $('<thead>').appendTo($table).addClass('thead');
		const $row = $('<tr>').appendTo($thead);
		for (const k of self.keys) {
			let text = k;
			for (let i = 0; i < dataset.orders.length; i++) {
				if (dataset.orders[i][0] == k) {
					if (dataset.orders[i][1] == 'DESC')
						text += ' &#9660;';
					else if (dataset.orders[i][1] == 'ASC')
						text += ' &#9650;';
				}
			}

			const $th = $('<th>').appendTo($row).html(text);
			if (k != 'reddit_url' && k != 'twitter_url') {
				// Ordering by clicking headers disabled for custom queries
				if (!dataset.is_custom_cmd) {
					$th.on('click', function () {
						let remove_index = -1;
						let in_orders = false;
						for (let i = 0; i < dataset.orders.length; i++) {
							if (dataset.orders[i][0] == k) {
								in_orders = true;
								if (dataset.orders[i][1] == 'DESC')
									dataset.orders[i][1] = 'ASC';
								else if (dataset.orders[i][1] == 'ASC')
									remove_index = i;
								else
									dataset.orders[i][1] = 'DESC';
							}
						}
						if (!in_orders)
							dataset.orders.push([k, 'DESC']);
						else if (remove_index != -1)
							dataset.orders.splice(remove_index, 1);
						window.dispatchEvent(request_update_event);
					});
				}
			}
		}

		// const stats = self.stats(dataset.data);
		const $tbody = $('<tbody>').appendTo($table).addClass('tbody');
		for (const row of dataset.data) {
			const $row = $('<tr>').appendTo($tbody);
			const $cache_row = {'$row': $row};
			self.$rows.push($cache_row);
			self.rows.push(row);
			// self.$view_rows.push($cache_row);
			// self.view_rows.push(row);

			for (const k of self.keys) {
				const $td = $('<td>').appendTo($row);
				const $cell = $('<div>').appendTo($td).addClass('cell');
				// const $cell_bg = $('<div>').appendTo($td).addClass('cell_bg');
				$cache_row[k] = $cell;

				let text = null;
				let no_tooltip = false;
				if (k == 'reddit_url') {
					const subreddit = row['subreddit'];
					const link_id = row['link_id'].split('_')[1];
					const id = row['id'];
					text = `<a style='display: inline-block; width: 100%; text-align: center;' href="https://www.reddit.com/r/${subreddit}/comments/${link_id}/*/${id}" target="#">Link to Reddit</a>`;
					no_tooltip = true;
				}
				else if (k == 'twitter_url') {
					const user_screen_name = row['user_screen_name'];
					const conversation_id = row['conversation_id'];
					text = `<a style='display: inline-block; width: 100%; text-align: center;' href="https://twitter.com/${user_screen_name}/status/${conversation_id}" target="#">Link to Tweet</a>`;
					no_tooltip = true;
				}
				else {
					text = row[k];
				}

				if (text == null) {
					text = 'null';
					$cell.addClass('null_cell');
				}

				const is_number = window.is_number(text);
				if (is_number) {
					if (text > 0)
						$cell.text(Number(text.toFixed(2)));
					else
						$cell.text(Number(text.toFixed(6)));
					$cell.css('text-align', 'right');
				}
				else {
					$cell.html(text);
				}

				if (!no_tooltip && !is_number && text.length > 0) {
					// Tooltip
					const $tooltip = $('<div>').appendTo($td).addClass('tooltip').text(text);
					$tooltip.on('click', function () {
						copy_to_clipboard(text);
					});
				}
			}
		}

		self.$view_rows = self.$rows;
		self.view_rows = self.rows;
		// Update cell css
		worker.postMessage({
			'name': 'scroll',
			'fn': 'stats',
			'args': self.view_rows,
		});
	}
}

class Editor {
	constructor() {
		const self = this;

		self.$execute = $('#execute_button');
		self.$reset = $('#reset_query_button');
		self.messages = [];

		self.editor_options = {
			highlightActiveLine: true,
			showLineNumbers: false,
			scrollPastEnd: 0.5,
			useWorker: true,
			readOnly: false,
			wrap: false,
			mode: 'ace/mode/mysql',
			show_mode_settings: true,
		};
		self.console_options = {
			animatedScroll: true,
			highlightActiveLine: false,
			showLineNumbers: false,
			scrollPastEnd: 0,
			useWorker: false,
			readOnly: true,
			wrap: false,
			mode: 'ace/mode/custom_console',
			// mode: 'ace/mode/mysql',
			show_mode_settings: false,
		};
		self.console_buffer_size = 5000;

		window.addEventListener('resized', function () {
			if (!$('.database_container').hasClass('active'))
				return;
			self.editor.update_gui.call(self.editor);
			self.console_editor.update_gui.call(self.console_editor);
		}, false);

		// self.editor_instruction = dataset.get_cmd();
		self.editor_instruction =
`-- Join finance and social media tables after aggregating by a time interval
SELECT	time,
		quotes.total_volume,
		quotes.avg_open AS opening_price,
		quotes.avg_close-quotes.avg_open AS price_change,
		quotes.avg_close AS closing_price,
		count AS media_mentions,
		pos_roberta_score,
		-neg_roberta_score,
		neu_roberta_score,
		mucbert_score,
		pos_finbert_score,
		-neg_finbert_score,
		neu_finbert_score,
		pos_lucbert_score,
		-neg_lucbert_score,
		pos_tb_score,
		neg_tb_score
	FROM (
		-- Scale sentiment scores
		SELECT	agg.*,
				pos_roberta / count AS pos_roberta_score,
				neg_roberta / count AS neg_roberta_score,
				neu_roberta / count AS neu_roberta_score,
				pos_lucbert / count AS pos_lucbert_score,
				neg_lucbert / count AS neg_lucbert_score,
				pos_finbert / count AS pos_finbert_score,
				neg_finbert / count AS neg_finbert_score,
				neu_finbert / count AS neu_finbert_score,
				pos_tb / (pos_tb + neg_tb) AS pos_tb_score,
				neg_tb / (pos_tb + neg_tb) AS neg_tb_score,
				(mucbert_1+2*mucbert_2+3*mucbert_3+4*mucbert_4+5*mucbert_5) /
					(5*(mucbert_1+mucbert_2+mucbert_3+mucbert_4+mucbert_5)) AS mucbert_score
			FROM (
				-- Aggregate sentiments by sign
				SELECT	DATE_FORMAT(datetime,'%Y-%m-%d') AS time,
						COUNT(*) AS count,
						SUM(CASE WHEN sa_roberta_entailment > sa_roberta_contradiction THEN 1 ELSE 0 END) AS pos_roberta,
						SUM(CASE WHEN sa_roberta_neutral > sa_roberta_entailment AND sa_roberta_neutral > sa_roberta_contradiction THEN 1 ELSE 0 END) AS neu_roberta,
						SUM(CASE WHEN sa_roberta_contradiction > sa_roberta_entailment AND sa_roberta_contradiction > sa_roberta_neutral THEN 1 ELSE 0 END) AS neg_roberta,
						SUM(CASE WHEN sa_lucbert_positive > sa_lucbert_negative THEN 1 ELSE 0 END) AS pos_lucbert,
						SUM(CASE WHEN sa_lucbert_negative > sa_lucbert_positive THEN 1 ELSE 0 END) AS neg_lucbert,
						SUM(CASE WHEN sa_finbert_positive > sa_finbert_neutral AND sa_finbert_positive > sa_finbert_negative THEN 1 ELSE 0 END) AS pos_finbert,
						SUM(CASE WHEN sa_finbert_neutral > sa_finbert_positive AND sa_finbert_neutral > sa_finbert_negative THEN 1 ELSE 0 END) AS neu_finbert,
						SUM(CASE WHEN sa_finbert_negative > sa_finbert_positive AND sa_finbert_negative > sa_finbert_neutral THEN 1 ELSE 0 END) AS neg_finbert,
						SUM(CASE WHEN tb_polarity > 100 THEN 1 ELSE 0 END) AS pos_tb,
						SUM(CASE WHEN tb_polarity < 100 THEN 1 ELSE 0 END) AS neg_tb,
						SUM(CASE WHEN sa_mucbert_5 > sa_mucbert_4 AND sa_mucbert_5 > sa_mucbert_3 AND sa_mucbert_5 > sa_mucbert_2 AND sa_mucbert_5 > sa_mucbert_1 THEN 1 ELSE 0 END) AS mucbert_5,
						SUM(CASE WHEN sa_mucbert_4 > sa_mucbert_5 AND sa_mucbert_4 > sa_mucbert_3 AND sa_mucbert_4 > sa_mucbert_2 AND sa_mucbert_4 > sa_mucbert_1 THEN 1 ELSE 0 END) AS mucbert_4,
						SUM(CASE WHEN sa_mucbert_3 > sa_mucbert_4 AND sa_mucbert_3 > sa_mucbert_5 AND sa_mucbert_3 > sa_mucbert_2 AND sa_mucbert_3 > sa_mucbert_1 THEN 1 ELSE 0 END) AS mucbert_3,
						SUM(CASE WHEN sa_mucbert_2 > sa_mucbert_4 AND sa_mucbert_2 > sa_mucbert_3 AND sa_mucbert_2 > sa_mucbert_5 AND sa_mucbert_2 > sa_mucbert_1 THEN 1 ELSE 0 END) AS mucbert_2,
						SUM(CASE WHEN sa_mucbert_1 > sa_mucbert_4 AND sa_mucbert_1 > sa_mucbert_3 AND sa_mucbert_1 > sa_mucbert_2 AND sa_mucbert_1 > sa_mucbert_5 THEN 1 ELSE 0 END) AS mucbert_1
					FROM Reddit_GME
					WHERE datetime > '2020-01-01 00:00:00' AND (subreddit = 'wallstreetbets' OR subreddit = 'GME')
					GROUP BY time
				) agg
		) sentiments
	LEFT JOIN (
		-- Aggregate volumes and closing prices
		SELECT	DATE_FORMAT(datetime,'%Y-%m-%d') AS _time,
				SUM(open) / COUNT(*) AS avg_open,
				SUM(close) / COUNT(*) AS avg_close,
				SUM(volume) AS total_volume
			FROM Finance_GME
			WHERE datetime > '2020-01-01 00:00:00' AND type = '1d'
			GROUP BY _time
		) quotes
	ON sentiments.time = quotes._time
	ORDER BY time DESC
	LIMIT 500
`;

		self.console_instruction =
`Console messages are displayed here.\nUse [CTRL+S] to execute query.`;

		self.editor = new window.Editor('script_editor', self.editor_options);
		self.editor.set_text(self.editor_instruction);
		self.initialize_console();

		// Execute sql command
		self.$execute.on('click', function () {
			if (is_querying)
				return;
			dataset.request_cmd = self.editor.get_text.apply(self.editor);
			window.dispatchEvent(request_update_event);
		});

		// Reset sql command
		self.$reset.on('click', function () {
			if (is_querying)
				return;
			const table = dataset.table;
			reset_dataset();
			dataset.table = table;
			window.dispatchEvent(request_update_event);
		});

		// Collapsing editor
		let is_collapsed = false;
		$('.collapse_view_button').on('click', function () {
			if (is_collapsed) {
				$('.collapse_view_button .icon').text('>');
				$('.editor_view').removeClass('horizontal_collapsed');
			}
			else {
				$('.collapse_view_button .icon').text('<');
				$('.editor_view').addClass('horizontal_collapsed');
			}
			is_collapsed = !is_collapsed;
		});
	}

	initialize_console() {
		this.console_editor = new window.Editor('console_editor', this.console_options);
		this.log(this.console_instruction);

		const self = this;
		$(window).on('mouseup touchend', function () {
			setTimeout(function () {
				self.console_editor.update_gui.call(self.console_editor);
			}, 100);
		});

		this.console_editor.scroll_to_bottom = true;

		// const $autoscroll_button = $('#autoscroll_button');
		// $autoscroll_button.val('Autoscroll: On');
		// $autoscroll_button.on('click', function () {
		// 	if (self.console_editor.scroll_to_bottom)
		// 		$autoscroll_button.val('Autoscroll: Off');
		// 	else
		// 		$autoscroll_button.val('Autoscroll: On');
		// 	self.console_editor.scroll_to_bottom = !self.console_editor.scroll_to_bottom;
		// });
	}

	display_messages() {
		const self = this;
		self.console_editor.set_text('');
		// Remove markers
		self.console_editor.clear_line_markers();
		self.console_editor.clear_text_markers();
		// Remove click listeners
		for (const handle of self.console_editor.handles)
			self.console_editor.editor.off('click', handle);
		self.console_editor.handles = [];
		// return;
		for (const message of self.messages)
			self.display_message(message);

		const session = self.console_editor.get_session();
		const rows = session.getLength();

		if (rows > self.console_buffer_size)
			self.messages.splice(0, 1);

		// Auto scroll
		if (self.console_editor.scroll_to_bottom)
			self.console_editor.scroll(rows);
	}

	display_message(message) {
		const self = this;

		// Console info
		let info_text = (' [' + message.type + ']').padEnd(12, ' ');
		info_text += (message.time).padEnd(11, ' ');
		info_text += (' | ' + message.took + 'ms').padEnd(12, ' ');
		info_text += '\n';

		// Concatenate
		let content_text = '\n';
		if (message.truncated)
			content_text += ' Server sent a truncated response.\n';
		for (const value of message.values) {
			const lines = value.data.split(/\r\n|\r|\n/);
			for (const i in lines)
				content_text += ' ' + lines[i] + '\n';
		}
		content_text += '\n';

		// Find the locations at which the strings to append belong
		const n_lines_info = info_text.split(/\r\n|\r|\n/).length - 1;
		const n_lines_content = content_text.split(/\r\n|\r|\n/).length - 1;
		const info_line_start = self.console_editor.get_text().split(/\r\n|\r|\n/).length - 1;
		const info_line_end = info_line_start + n_lines_info;
		const content_line_start = info_line_end;
		const content_line_end = content_line_start + n_lines_content;

		// Fold code
		const session = self.console_editor.get_session();
		const message_text = info_text + content_text + '\n';
		session.insert({row: session.getLength(), column: 0}, message_text);
		session.foldAll(content_line_start, content_line_end);

		// Line highlighting
		let type = message.type;
		if (type == 'query')
			type = 'blue';
		else if (type == 'response')
			type = 'log';
		self.console_editor.add_line_marker(content_line_start, content_line_end, type);
		self.console_editor.add_line_marker(info_line_start, content_line_end, 'border');
	}

	log(message, took=0) {
		const self = this;
		if (self.console_editor) {
			if (!self.console_editor.handles)
				self.console_editor.handles = [];
			if (typeof message === 'string') {
				message = {
					type: 'info',
					timestamp: Date.now(),
					took: took,
					values: [{
						data: message,
						type: 'string',
						name: 'String',
					}],
				};
			}
			message.time = (new Date(message.timestamp)).toLocaleTimeString();
			message.took = message.took > 0 ? '+' + message.took : message.took;

			// Add to message history
			self.messages.push(message);

			// Display message history
			self.display_messages();
		}
	}
}

// class Words {
// 	constructor() {
// 		const self = this;
// 		self.canvas_id = 'words_canvas';
// 		self.$parent = $('.words_container');
// 		self.$canvas = $('#'+self.canvas_id);
// 		self.c = self.$canvas[0].getContext('2d');

// 		self.panning = false;
// 		self.dragging = false;
// 		self.dragged = false;
// 		self.camera = new Vector(0, 0);
// 		self.zoom = 1.0;

// 		self.resized();
// 		self.render();
// 		window.addEventListener('resized', function () {
// 			self.resized.apply(self);
// 			self.render.apply(self);
// 		}, false);


// 		self.$canvas.on('mousemove', function (e) {
// 			const offset = self.$parent.offset();
// 			self.p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));
// 			self.pw = self.to_world(self.p);

// 			if (self.dragging)
// 				self.drag2w = self.pw.add(self.camera);

// 			if (self.panning) {
// 				const dw = self.pw.sub(self.last_pw);
// 				self.camera = self.camera.sub(dw);
// 				self.last_pw = self.to_world(self.p);
// 				// console.log(self.camera);
// 			}

// 			self.render();
// 		});

// 		self.$canvas.on('mousedown', function (e) {
// 			const offset = self.$parent.offset();
// 			const p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));

// 			if (event.which == 1) {
// 				self.panning = true;
// 				self.last_pw = self.to_world(p);
// 			}
// 			else if (event.which == 3) {
// 				self.dragging = true;
// 				self.dragged = false;
// 				self.drag1w = self.to_world(p);
// 				self.drag1w = self.drag1w.add(self.camera);
// 			}
// 		});

// 		self.$canvas.on('mouseup', function (e) {
// 			const offset = self.$parent.offset();
// 			const p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));

// 			if (event.which == 1) {
// 				self.panning = false;
// 				self.last_pw = null;
// 			}
// 			else if (event.which == 3) {
// 				if (!self.dragging)
// 					return;
// 				self.dragging = false;
// 				self.drag2w = self.to_world(p);
// 				self.drag2w = self.drag2w.add(self.camera);

// 				const dist = self.drag2w.sub(self.drag1w).length();
// 				if (dist > 0.01)
// 					self.dragged = true;
// 				else
// 					self.render();
// 			}
// 		});

// 		self.$canvas.on('mouseleave', function (e) {
// 			self.panning = false;
// 			self.last_pw = null;
// 			self.dragging = false;
// 			self.render();
// 		});

// 		self.$canvas.bind('mousewheel DOMMouseScroll', function (e) {
// 			// if (e.target.id != self.canvas_id)
// 			// 	return;
// 			// || e.originalEvent.detail < 0) {
// 			if (e.originalEvent.wheelDeltaY > 0) {
// 				self.zoom += 0.1;
// 				if (self.zoom > 100)
// 					self.zoom = 100;
// 				console.log('scroll up', self.zoom);
// 			}
// 			else if (e.originalEvent.wheelDeltaY < 0) {
// 				self.zoom -= 0.1;
// 				if (self.zoom < 0.1)
// 					self.zoom = 0.1;
// 				console.log('scroll down', self.zoom);
// 			}

// 			// if (e.originalEvent.wheelDeltaX > 0) {
// 			// 	console.log('scroll left');
// 			// }
// 			// else if (e.originalEvent.wheelDeltaX < 0) {
// 			// 	console.log('scroll right');
// 			// }
// 			const delta = new Vector(e.originalEvent.wheelDeltaX, 0);
// 			self.camera = self.camera.sub(self.to_world(delta));
// 			self.render();
// 		});
// 	}

// 	to_world(s, apply_cam=true) {
// 		const self = this;
// 		if (apply_cam)
// 			s = s.add(self.to_screen(self.camera));
// 		const x = s.x / self.width;
// 		const y = s.y / self.height;
// 		let w = new Vector(x, y);
// 		// w = w.scale(1/self.zoom);
// 		return w;
// 	}

// 	to_screen(w, apply_cam=true) {
// 		const self = this;
// 		// w = w.scale(self.zoom);
// 		const x = w.x * self.width;
// 		const y = w.y * self.height;
// 		let s = new Vector(x, y);
// 		if (apply_cam)
// 			s = s.sub(self.camera.mul(new Vector(self.width, self.height)));
// 		return s;
// 	}

// 	resized() {
// 		const self = this;
// 		self.width = self.$parent.outerWidth();
// 		self.height = self.$parent.outerHeight();
// 		// self.$canvas[0].width = self.width;
// 		// self.$canvas[0].height = self.height;
// 		self.$canvas.attr({
// 			width: self.width,
// 			height: self.height,
// 		});
// 	}

// 	render() {
// 		const self = this;

// 		const w = self.width;
// 		const h = self.height;

// 		// Background
// 		self.c.save();
// 		self.c.fillStyle = '#fff';
// 		self.c.fillRect(0, 0, w, h);
// 		self.c.restore();

// 		// Test
// 		self.c.save();
// 		const aw = new Vector(0.5, 0.5);
// 		const sw = new Vector(0.1, 0.1);
// 		const bw = aw.add(sw);
// 		const a = self.to_screen(aw);
// 		const b = self.to_screen(bw);
// 		const s = b.sub(a);
// 		self.c.fillStyle = '#000';
// 		self.c.fillRect(a.x, a.y, s.x, s.y);
// 		self.c.restore();

// 		// Current position
// 		if (self.p != null) {
// 			const p = self.p;

// 			self.c.save();
// 			self.c.strokeStyle = 'rgba(0, 0, 0, 0.8)';
// 			self.c.setLineDash([8, 4]);
// 			self.c.lineWidth = '0.5';
// 			// Vertical
// 			self.c.beginPath();
// 			self.c.moveTo(p.x, 0);
// 			self.c.lineTo(p.x, h);
// 			self.c.stroke();
// 			// Horizontal
// 			self.c.beginPath();
// 			self.c.moveTo(0, p.y);
// 			self.c.lineTo(w, p.y);
// 			self.c.stroke();
// 			self.c.restore();
// 		}

// 		// Drag
// 		if (self.dragging || self.dragged) {
// 			const a = self.to_screen(self.drag1w);
// 			const b = self.to_screen(self.drag2w);

// 			self.c.save();
// 			self.c.fillStyle = 'rgba(150, 150, 150, 0.2)';
// 			// Area
// 			self.c.beginPath();
// 			self.c.moveTo(a.x, a.y);
// 			self.c.lineTo(a.x, b.y);
// 			self.c.lineTo(b.x, b.y);
// 			self.c.lineTo(b.x, a.y);
// 			self.c.fill();
// 			self.c.restore();
// 		}
// 	}
// }

class Chart {
	constructor() {
		const self = this;

		self.symbol = 'GME';
		self.type = 'Reddit';

		self.canvas_id = 'chart_canvas';
		self.$parent = $('#chart_canvas_container');
		self.$canvas = $('#'+self.canvas_id);
		self.c = self.$canvas[0].getContext('2d');

		self.cloud = new Cloud();
		self.table = new WordTable();

		self.x_padding = 80;
		self.y_padding = 30;
		self.n_ts = 80;
		self.panning = false;
		self.dragging = false;
		self.dragged = false;
		self.camera = new Vector(0, 0);
		// self.zoom = 0.2;
		self.zoomi = 100;

		self.word_cols = [
			'ner_lcbert_person',
			'ner_lcbert_organization',
			// 'ner_lcbert_location',
			'ner_lcbert_miscellaneous',
			// 'tb_noun_phrases',
			'tb_nouns',
			// 'tb_verbs',
			// 'tb_adjectives',
		];

		self.$ticker_select = $('#ticker_select');
		self.$type_select = $('#chart_type_select');
		self.type = self.$type_select.val();

		// On platform type changed
		self.$type_select.on('change', function () {
			self.type = self.$type_select.val();
			// Update table
			self.table.type = self.type;
			if (self.table.symbol)
				self.table.get_data(
					self.table.symbol,
					self.table.from,
					self.table.to
				).then(self.table.show.bind(self.table));

			self.get_word_data().then(self.set_word_data.bind(self));
		});

		// // Enumerate ticker options
		// self.table_wait_timer = setInterval(function () {
		// 	if (!dataset || !dataset.tables)
		// 		return;
		// 	const symbols = new Set();
		// 	for (const table of dataset.tables)
		// 		symbols.add(table.split('_')[1]);
		// 	for (const s of symbols) {
		// 		const $o = $('<option>')
		// 			.appendTo(self.$ticker_select)
		// 			.val(s)
		// 			.text(s);
		// 		if (s == self.symbol)
		// 			$o.prop('selected', true);
		// 	}
		// 	clearInterval(self.table_wait_timer);
		// }, 1000);

		self.$ticker_select.on('change', function () {
			self.symbol = self.$ticker_select.val();
			self.get_data();
		});

		self.resized();
		self.render();
		window.addEventListener('resized', function () {
			if (!$('.chart_container').hasClass('active'))
				return;
			self.resized.apply(self);
			self.render.apply(self);
		}, false);

		self.$canvas.on('mousemove touchmove', function (e) {
			const offset = self.$parent.offset();
			self.p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));
			self.pw = self.to_world(self.p);

			if (self.dragging)
				self.drag2w = self.pw.add(self.camera);

			if (self.panning) {
				const dw = self.pw.sub(self.last_pw);
				self.camera = self.camera.sub(new Vector(dw.x, 0));
				self.last_pw = self.to_world(self.p);
				// console.log(self.camera);
			}
			self.render(false);
		});

		self.$canvas.on('mousedown touchstart', function (e) {
			const offset = self.$parent.offset();
			const p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));

			if (event.which == 1) {
				self.panning = true;
				self.last_pw = self.to_world(p);
			}
			else if (event.which == 3) {
				self.dragging = true;
				self.dragged = false;
				self.drag1w = self.to_world(p);
				self.drag1w = self.drag1w.add(self.camera);
			}
		});

		self.$canvas.on('mouseup touchend', function (e) {
			const offset = self.$parent.offset();
			const p = new Vector((e.pageX - offset.left), (e.pageY - offset.top));

			if (event.which == 1) {
				self.panning = false;
				self.last_pw = null;
				self.render(true);
			}
			else if (event.which == 3) {
				if (!self.dragging)
					return;
				self.dragging = false;
				self.drag2w = self.to_world(p);
				self.drag2w = self.drag2w.add(self.camera);

				const dist = self.drag2w.sub(self.drag1w).length();
				if (dist > 0.01)
					self.dragged = true;
				else
					self.render(false);
			}
		});

		self.$canvas.on('mouseleave touchcancel', function (e) {
			self.panning = false;
			self.last_pw = null;
			self.dragging = false;
			self.render(false);
		});

		// self.$canvas.bind('mousewheel DOMMouseScroll', function (e) {
		// 	if (e.originalEvent.wheelDeltaY > 0) {
		// 		self.zoomi /= 1.05;
		// 		if (self.zoomi < 50)
		// 			self.zoomi = 50;
		// 		// console.log('scroll up', self.zoomi);
		// 	}
		// 	else if (e.originalEvent.wheelDeltaY < 0) {
		// 		self.zoomi *= 1.05;
		// 		if (self.zoomi > 300)
		// 			self.zoomi = 300;
		// 		// console.log('scroll down', self.zoomi);
		// 	}
		// 	const delta = new Vector(e.originalEvent.wheelDeltaX, 0);
		// 	self.camera = self.camera.sub(self.to_world(delta));
		// 	self.render(true);
		// });

		// self.get_data();
	}

	to_world(s, apply_cam=true) {
		const self = this;
		// s = s.sub(new Vector(self.width/2, 0));
		// s = s.mul(new Vector(1/self.zoomi, 1));
		if (apply_cam)
			s = s.add(self.to_screen(self.camera));
		const x = s.x / self.width;
		const y = s.y / self.height;
		let w = new Vector(x, y);
		return w;
		return s;
	}

	to_screen(w, apply_cam=true) {
		const self = this;
		const x = w.x * self.width;
		const y = w.y * self.height;
		let s = new Vector(x, y);
		if (apply_cam)
			s = s.sub(self.camera.mul(new Vector(self.width, self.height)));
		// s = s.mul(new Vector(self.zoomi, 1));
		// s = s.add(new Vector(self.width/2, 0));
		return s;
	}

	resized() {
		const self = this;
		self.width = self.$parent.width();
		self.height = self.$parent.height();
		// self.width = self.$canvas.innerWidth();
		// self.height = self.$canvas.innerWidth();

		// self.$canvas.attr('width', Math.floor(self.width));
		// self.$canvas.attr('height', Math.floor(self.height));
		// self.$canvas[0].height = self.height;

		// self.$canvas.css({
		// 	width: Math.floor(self.width)+'px',
		// 	height: Math.floor(self.height)+'px',
		// });
		// self.$parent.css({
		// 	minwidth: Math.floor(self.width)+'px',
		// 	height: Math.floor(self.height)+'px',
		// });
		self.$canvas.attr({
			width: Math.floor(self.width),
			height: Math.floor(self.height),
		});
	}

	set_tickers(tables) {
		const self = this;
		self.$ticker_select.empty();
		const symbols = new Set();
		for (const table of tables)
			symbols.add(table.split('_')[1]);
		for (const s of symbols) {
			const $o = $('<option>')
				.appendTo(self.$ticker_select)
				.val(s)
				.text(s);
			if (s == self.symbol)
				$o.prop('selected', true);
		}
	}

	set_price_data(data) {
		const self = this;
		for (const i in data)
			data[i]['date'] = parse_datetime(data[i]['datetime'], true);
		self.data = data;
		self.render();
	}

	set_reddit_data(data) {
		const self = this;
		for (const i in data) {
			const date = parse_datetime(data[i]['time'], true);
			for (const k in self.data)
				if (date_eq(self.data[k]['date'], date))
					self.data[k]['reddit_mentions'] = data[i]['count'];
		}
		self.render();
	}

	set_twitter_data(data) {
		const self = this;
		for (const i in data) {
			const date = parse_datetime(data[i]['time'], true);
			for (const k in self.data)
				if (date_eq(self.data[k]['date'], date))
					self.data[k]['twitter_mentions'] = data[i]['count'];
		}
		self.render();
	}

	set_word_data(data) {
		const self = this;
		worker.postMessage({
			'name': 'words',
			'fn': 'words',
			'args': [data, self.info, self.word_cols],
		});
	}

	get_word_command(symbol, interval=15, chunks=4) {
		const self = this;
		const word_cols_str = self.word_cols.join(',');
		const all_word_dates = [];
		const dates = self.get_data_dates(self.data);
		for (const i in dates)
			if (i % interval == 0)
				all_word_dates.push(dates[i]);

		const cmds = [];
		for (let i = 0, j = all_word_dates.length; i < j; i += chunks) {
			const word_dates = all_word_dates.slice(i, i + chunks);

			const word_dates_cmp = [];
			for (const d of word_dates)
				word_dates_cmp.push(`DATE_FORMAT(datetime,"%Y-%m-%d") = "${datetime_to_string(d, true)}"`);
			const word_dates_cmp_str = word_dates_cmp.join(' OR ');

			let cmd;
			if (self.type == 'Reddit') {
				cmd =
				`SELECT datetime,
						${word_cols_str}
					FROM ${self.type}_${symbol}
					WHERE ${word_dates_cmp_str} AND subreddit = 'wallstreetbets' AND score > 1
					ORDER BY datetime ASC;`;
			}
			if (self.type == 'Twitter') {
				cmd =
				`SELECT datetime,
						${word_cols_str}
					FROM ${self.type}_${symbol}
					WHERE ${word_dates_cmp_str} AND user_followers_count > 1000 AND symbols LIKE "%${symbol}%"
					ORDER BY datetime ASC;`;
			}
			cmds.push(cmd);
		}
		return cmds;
	}

	get_word_data() {
		const self = this;
		return new Promise(function (resolve, reject) {
			const promises = [];
			const cmds = self.get_word_command(self.symbol);
			for (const cmd of cmds)
				promises.push(execute(cmd));
			Promise.all(promises)
				.then(function (res) {
					const data = [];
					for (const r of res)
						data.push(...r.value);
					resolve(data);
				});
		});
	}

	get_data() {
		const self = this;
		const from = '2020-01-01 00:00:00';
		// const _from = new Date(2021, 1, 1, 0, 0, 0, 0);
		// const from = datetime_to_string(_from);
		const to = '2030-01-01 00:00:00';
		// const _to = utc_now();
		// const to = datetime_to_string(_to);

		// console.log(from, to);
		const cmd0 =
			`SELECT *
				FROM All_Symbols
				WHERE symbol = "${self.symbol}";`;
		const cmd1 =
			`SELECT *
				FROM Finance_${self.symbol}
				WHERE datetime > "${from}" AND datetime < "${to}" AND type = "1d"
				ORDER BY datetime ASC;`;
		const cmd2 =
			`SELECT	DATE_FORMAT(datetime,'%Y-%m-%d') AS time,
					SUM(CASE WHEN sa_roberta_entailment > sa_roberta_contradiction AND sa_roberta_entailment > sa_roberta_neutral THEN 1 ELSE 0 END) AS pos_roberta,
					SUM(CASE WHEN sa_roberta_neutral > sa_roberta_entailment AND sa_roberta_neutral > sa_roberta_contradiction THEN 1 ELSE 0 END) AS neu_roberta,
					SUM(CASE WHEN sa_roberta_contradiction > sa_roberta_entailment AND sa_roberta_contradiction > sa_roberta_neutral THEN 1 ELSE 0 END) AS neg_roberta,
					COUNT(*) AS count
				FROM Reddit_${self.symbol}
				WHERE datetime > "${from}" AND datetime < "${to}"
				GROUP BY time
				ORDER BY datetime ASC;`;
		const cmd3 =
			`SELECT	DATE_FORMAT(datetime,'%Y-%m-%d') AS time,
					SUM(CASE WHEN sa_roberta_entailment > sa_roberta_contradiction AND sa_roberta_entailment > sa_roberta_neutral THEN 1 ELSE 0 END) AS pos_roberta,
					SUM(CASE WHEN sa_roberta_neutral > sa_roberta_entailment AND sa_roberta_neutral > sa_roberta_contradiction THEN 1 ELSE 0 END) AS neu_roberta,
					SUM(CASE WHEN sa_roberta_contradiction > sa_roberta_entailment AND sa_roberta_contradiction > sa_roberta_neutral THEN 1 ELSE 0 END) AS neg_roberta,
					COUNT(*) AS count
				FROM Twitter_${self.symbol}
				WHERE datetime > "${from}" AND datetime < "${to}"
				GROUP BY time
				ORDER BY datetime ASC;`;
		execute(cmd0)
			.then(function (res) {
				self.info = res.value[0];
				return execute(cmd1);
			})
			.then(function (res) {
				console.log('Ready finance');
				self.set_price_data(res.value);
				return execute(cmd2);
			})
			.then(function (res) {
				console.log('Ready reddit mentions');
				self.set_reddit_data(res.value);
				return execute(cmd3);
			})
			.then(function (res) {
				console.log('Ready twitter mentions');
				self.set_twitter_data(res.value);
				return self.get_word_data();
			})
			.then(function (res) {
				console.log('Ready word count');
				self.set_word_data(res);
			});
	}

	get_tw_widths() {
		const self = this;
		const max_tw = 1-self.padding_w.x;
		const spacing = max_tw/self.n_ts;
		return {
			'spacing': spacing,
			'oc_width': 3*spacing/4,
			'hl_width': self.to_world(new Vector(2, 0)).x,
		};
	}

	get_tws(dates) {
		const self = this;
		const max_tw = 1-self.padding_w.x;
		const spacing = max_tw/self.n_ts;
		const dates_and_axisw = [];

		let t = max_tw + spacing*dates.length - 1.0+self.padding_w.x*2;
		for (const i in dates) {
			const date = dates[i];
			t -= spacing;
			const pos = self.to_screen(new Vector(t, 0));
			if (pos.x < 0)
				break;
			if (pos.x > self.width-self.x_padding)
				continue;
			dates_and_axisw.push([date, t]);
		}
		return dates_and_axisw;
	}

	get_selected_date(tws=null) {
		const self = this;
		if (self.pw) {
			const tw_widths = self.get_tw_widths();
			const spacing = tw_widths['spacing'];
			for (const pair of tws) {
				const date = pair[0];
				const t = pair[1];
				if (self.pw.x+self.camera.x < (t+spacing/2) && self.pw.x+self.camera.x > (t-spacing/2))
					return date;
			}
		}
		return null;
	}

	get_data_dates(data) {
		const dates = [];
		for (const d of data)
			dates.push(parse_datetime(d['date']));
		return dates.reverse();
	}

	render(recalculate=true) {
		const self = this;
		const w = self.width;
		const h = self.height;
		self.padding_w = self.to_world(new Vector(self.x_padding, self.y_padding));

		// console.log(self.camera.x);

		// Background
		self.c.save();
		self.c.fillStyle = '#fff';
		self.c.fillRect(0, 0, w, h);
		self.c.restore();

		// Current position
		if (self.p != null) {
			const p = self.p;

			self.c.save();
			self.c.strokeStyle = 'rgba(0, 0, 0, 0.8)';
			self.c.setLineDash([8, 4]);
			self.c.lineWidth = '0.5';
			// Vertical
			self.c.beginPath();
			self.c.moveTo(p.x, 0);
			self.c.lineTo(p.x, h);
			self.c.stroke();
			// Horizontal
			self.c.beginPath();
			self.c.moveTo(0, p.y);
			self.c.lineTo(w, p.y);
			self.c.stroke();
			self.c.restore();
		}

		// Drag
		if (self.dragging || self.dragged) {
			const a = self.to_screen(self.drag1w);
			const b = self.to_screen(self.drag2w);

			self.c.save();
			self.c.fillStyle = 'rgba(150, 150, 150, 0.2)';
			// Area
			self.c.beginPath();
			self.c.moveTo(a.x, a.y);
			self.c.lineTo(a.x, b.y);
			self.c.lineTo(b.x, b.y);
			self.c.lineTo(b.x, a.y);
			self.c.fill();
			self.c.restore();
		}

		// Axis
		self.c.save();
		self.c.strokeStyle = 'rgba(0, 0, 0, 0.8)';
		self.c.lineWidth = '2';
		// Vertical
		self.c.beginPath();
		self.c.moveTo(w-self.x_padding, 0);
		self.c.lineTo(w-self.x_padding, h-self.y_padding);
		self.c.stroke();
		// Horizontal
		self.c.beginPath();
		self.c.moveTo(0, h-self.y_padding);
		self.c.lineTo(w-self.x_padding, h-self.y_padding);
		self.c.stroke();
		self.c.restore();

		// Plot data
		if (self.data != null && self.data.length > 0) {
			const start = self.data[0]['date'];
			// const start = parse_datetime('2020-01-01 00:00:00');
			const end = utc_now().add_days(1);
			// const dates = get_range(start, end, true);
			const dates = self.get_data_dates(self.data);
			self.dates = dates;

			// console.log('\nstart1', start, '\nend1', end, '\nstart2', dates[dates.length-1], '\nend2', dates[0]);
			// Draw date axis
			const tws = self.get_tws(dates);
			let last_mo = null;
			for (const pair of tws) {
				const date = pair[0];
				const t = pair[1];

				const date_m = MONTHS[date.getMonth()];
				// const date_d = date.getDate();
				// const date_y = date.getFullYear();
				// const date_h = date.getHours();

				// Date text
				let date_str = '';
				let color = 'rgba(150, 150, 150, 0.8)';
				if (last_mo != date_m) {
					if (last_mo != null)
						date_str = last_mo;
					last_mo = date_m;
					color = 'rgba(50, 50, 50, 0.8)';
				// 	if (date_m == 'Jan') {
				// 		date_str = date_y;
				// 		color = 'rgba(0, 0, 0, 0.8)';
				// 	}
				}
				// else {
				// 	date_str = date_d;
				// 	// Skip even
				// 	if ((1/self.zoomi) < 0.7 && date_d%2 != 1)
				// 		date_str = '';
				// 	// Show intervals
				// 	if ((1/self.zoomi) < 0.5 && date_d%4 != 1)
				// 		date_str = '';
				// 	if ((1/self.zoomi) < 0.2 && date_d%9 != 1)
				// 		date_str = '';
				// 	if ((1/self.zoomi) < 0.1)
				// 		date_str = '';
				// }

				// Draw date text
				const date_pos = self.to_screen(new Vector(t, 0));
				const rotate_date = false;
				self.c.save();
				self.c.font = '16px Arial';
				self.c.fillStyle = color;
				if (rotate_date) {
					self.c.translate(date_pos.x, h-self.y_padding/2);
					self.c.rotate(-Math.PI/2);
					self.c.fillText(date_str, 0, 0);
				}
				else {
					self.c.textAlign = 'center';
					self.c.fillText(date_str, date_pos.x, h-self.y_padding/2);
				}
				self.c.restore();
				// Draw vertical grid
				if (date_str != '') {
					self.c.save();
					self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
					self.c.lineWidth = '1';
					self.c.beginPath();
					self.c.moveTo(date_pos.x, 0);
					self.c.lineTo(date_pos.x, h-self.y_padding);
					self.c.stroke();
					self.c.restore();
				}
			}

			// Find max min
			if (recalculate) {
				const price_cols = ['open', 'high', 'low', 'close'];
				self.max_p = null;
				self.min_p = null;
				self.max_v = null;
				self.min_v = null;
				self.max_rm = null;
				self.min_rm = null;
				self.max_tm = null;
				self.min_tm = null;
				for (const pair of tws) {
					const date = pair[0];
					for (const d of self.data) {
						if (date_eq(d['date'], date)) {
							// Prices
							for (const col of price_cols) {
								if (self.max_p == null)
									self.max_p = d[col];
								if (self.max_p < d[col])
									self.max_p = d[col];
								if (self.min_p == null)
									self.min_p = d[col];
								if (self.min_p > d[col])
									self.min_p = d[col];
							}
							// Volumes
							if (self.max_v == null)
								self.max_v = d['volume'];
							if (self.max_v < d['volume'])
								self.max_v = d['volume'];
							if (self.min_v == null)
								self.min_v = d['volume'];
							if (self.min_v > d['volume'])
								self.min_v = d['volume'];
							// Mentions
							if (self.max_rm == null)
								self.max_rm = d['reddit_mentions'];
							if (self.max_rm < d['reddit_mentions'])
								self.max_rm = d['reddit_mentions'];
							if (self.min_rm == null)
								self.min_rm = d['reddit_mentions'];
							if (self.min_rm > d['reddit_mentions'])
								self.min_rm = d['reddit_mentions'];
							// Mentions
							if (self.max_tm == null)
								self.max_tm = d['twitter_mentions'];
							if (self.max_tm < d['twitter_mentions'])
								self.max_tm = d['twitter_mentions'];
							if (self.min_tm == null)
								self.min_tm = d['twitter_mentions'];
							if (self.min_tm > d['twitter_mentions'])
								self.min_tm = d['twitter_mentions'];
						}
					}
				}
			}

			// Words table
			if (is_paused && tws.length > 0) {
				clearTimeout(self.get_table_timer);
				self.get_table_timer = setTimeout(function () {
					self.table.get_data(self.symbol, tws[0][0], tws[tws.length-1][0])
						.then(function () {
							self.table.show(tws[0][0]);
						});
				}, 500);
			}

			// Get words in view
			if (is_paused && self.agg_words) {
				const all_words = {};
				let incl_dates = [];
				for (const pair of tws) {
					const d1 = pair[0];
					for (const date_str of Object.keys(self.agg_words)) {
						const d2 = new Date(date_str).add_days(1);
						if (date_eq(d1, d2)) {
							incl_dates.push(d1);
							for (const w in self.agg_words[date_str]) {
								const n = self.agg_words[date_str][w];
								if (!all_words.hasOwnProperty(w))
									all_words[w] = 0;
								all_words[w] += n;
							}
						}
					}
				}
				let is_equal = true;
				if (self.incl_dates) {
					if (self.incl_dates.length != incl_dates.length)
						is_equal = false;
					else
						for (const i in self.incl_dates)
							if (!date_eq(self.incl_dates[i], incl_dates[i]))
								is_equal = false;
				}
				else {
					is_equal = false;
				}

				if (!is_equal) {
					$loading2.show();
					clearTimeout(self.word_cloud_timer);
					self.word_cloud_timer = setTimeout(function () {
						if (!is_equal) {
							const words = [];
							for (const k of Object.keys(all_words)) {
								const n = all_words[k];
								if (n > 2)
									words.push({
										'text': k,
										'size': n,
									});
							}
							if (words.length > 0)
								self.cloud.set_words(words, datetime_to_string(incl_dates[0]));
						}
					}, 500);
				}

				self.incl_dates = incl_dates;
			}

			// Percentage of screen at which price chart starts
			const padding = 0.1;
			const section_volumes = 0.15;
			const section_reddit_mentions = 0.15;
			const section_twitter_mentions = 0.15;
			const section_prices = (1-section_volumes-section_reddit_mentions-section_twitter_mentions) - self.padding_w.y;
			function price_to_w(p) {
				const r = (p-self.min_p) / (self.max_p-self.min_p);
				const ri = 1-r;
				const i1 = section_prices * ri * (1-padding);
				const w = i1 + (section_prices*padding/2);
				return w;
			}
			function w_to_price(w) {
				const i1 = w - (section_prices*padding/2);
				const ri = i1 / section_prices / (1-padding);
				const r = -(ri-1);
				const p = r * (self.max_p-self.min_p) + self.min_p;
				return p;
			}
			function volume_to_w(v) {
				const r = (v-self.min_v) / (self.max_v-self.min_v);
				const ri = 1-r;
				const i1 = section_volumes * ri * (1-padding);
				const w = section_prices + i1 + (section_volumes*padding/2);
				return w;
			}
			function w_to_volume(w) {
				const i1 = w - section_prices - (section_volumes*padding/2);
				const ri = i1 / section_volumes / (1-padding);
				const r = -(ri-1);
				const v = r * (self.max_v-self.min_v) + self.min_v;
				return v;
			}
			function rmention_to_w(m) {
				const r = (m-self.min_rm) / (self.max_rm-self.min_rm);
				const ri = 1-r;
				const i1 = section_reddit_mentions * ri * (1-padding);
				const w = section_prices + section_volumes + i1 + (section_reddit_mentions*padding/2);
				return w;
			}
			function w_to_rmention(w) {
				const i1 = w - section_prices - section_volumes - (section_reddit_mentions*padding/2);
				const ri = i1 / section_reddit_mentions / (1-padding);
				const r = -(ri-1);
				const m = r * (self.max_rm-self.min_rm) + self.min_rm;
				return m;
			}
			function tmention_to_w(m) {
				const r = (m-self.min_tm) / (self.max_tm-self.min_tm);
				const ri = 1-r;
				const i1 = section_twitter_mentions * ri * (1-padding);
				const w = section_prices + section_volumes + section_reddit_mentions + i1 + (section_twitter_mentions*padding/2);
				return w;
			}
			function w_to_tmention(w) {
				const i1 = w - section_prices - section_volumes - section_reddit_mentions - (section_twitter_mentions*padding/2);
				const ri = i1 / section_twitter_mentions / (1-padding);
				const r = -(ri-1);
				const m = r * (self.max_tm-self.min_tm) + self.min_tm;
				return m;
			}

			// Draw horizontal border between prices and volumes
			const border_color = 'rgba(0, 0, 0, 0.4)';
			const border_width = 2;
			self.c.save();
			self.c.strokeStyle = border_color;
			self.c.lineWidth = border_width;
			self.c.beginPath();
			const bottom1 = self.to_screen(new Vector(0, section_prices)).y;
			self.c.moveTo(0, bottom1);
			self.c.lineTo(w-self.x_padding, bottom1);
			self.c.stroke();
			self.c.restore();
			// Axis title
			self.c.save();
			self.c.font = '14px Arial';
			self.c.fillStyle = 'rgba(0, 0, 0, 0.6)';
			self.c.fillText('Volume', 10, bottom1+20);
			self.c.restore();
			// Draw horizontal border between reddit_mentions and volumes
			self.c.save();
			self.c.strokeStyle = border_color;
			self.c.lineWidth = border_width;
			self.c.beginPath();
			const bottom2 = self.to_screen(new Vector(0, section_prices+section_volumes)).y;
			self.c.moveTo(0, bottom2);
			self.c.lineTo(w-self.x_padding, bottom2);
			self.c.stroke();
			self.c.restore();
			// Axis title
			self.c.save();
			self.c.font = '14px Arial';
			self.c.fillStyle = 'rgba(0, 0, 0, 0.6)';
			self.c.fillText('Reddit mentions', 10, bottom2+20);
			self.c.restore();
			// Draw horizontal border between twitter_mentions and reddit_mentions
			self.c.save();
			self.c.strokeStyle = border_color;
			self.c.lineWidth = border_width;
			self.c.beginPath();
			const bottom3 = self.to_screen(new Vector(0, section_prices+section_volumes+section_reddit_mentions)).y;
			self.c.moveTo(0, bottom3);
			self.c.lineTo(w-self.x_padding, bottom3);
			self.c.stroke();
			self.c.restore();
			// Axis title
			self.c.save();
			self.c.font = '14px Arial';
			self.c.fillStyle = 'rgba(0, 0, 0, 0.6)';
			self.c.fillText('Twitter mentions', 10, bottom3+20);
			self.c.restore();

			const max_label_y_offset = 16;
			const min_label_y_offset = -10;

			// Draw y axis labels
			const n_labels = 4;
			if (self.min_p != null && self.max_p != null) {
				// Min max price
				const max_pw = price_to_w(self.max_p);
				const min_pw = price_to_w(self.min_p);
				const pl_label = self.to_screen(new Vector(0, max_pw));
				const ph_label = self.to_screen(new Vector(0, min_pw));
				self.c.save();
				self.c.font = '14px Arial';
				self.c.fillStyle = 'rgba(0, 0, 0, 0.8)';
				self.c.fillText('$'+self.max_p.toFixed(2), w-self.x_padding+4, pl_label.y+max_label_y_offset);
				self.c.fillText('$'+self.min_p.toFixed(2), w-self.x_padding+4, ph_label.y+min_label_y_offset);
				self.c.restore();
				// Draw horizontal grid
				self.c.save();
				self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
				self.c.lineWidth = '1';
				self.c.beginPath();
				self.c.moveTo(0, ph_label.y);
				self.c.lineTo(w-self.x_padding, ph_label.y);
				self.c.stroke();
				self.c.beginPath();
				self.c.moveTo(0, pl_label.y);
				self.c.lineTo(w-self.x_padding, pl_label.y);
				self.c.stroke();
				self.c.restore();

				// Draw horizontal ticks at n_label intervals
				for (let i = 0; i < n_labels; i++) {
					const p = (i+1) * (self.max_p-self.min_p)/(n_labels+1) + self.min_p;
					const pw = price_to_w(p);
					const pl = self.to_screen(new Vector(0, pw));
					// Text
					self.c.save();
					self.c.font = '14px Arial';
					self.c.fillStyle = 'rgba(0, 0, 0, 0.8)';
					self.c.fillText('$'+p.toFixed(2), w-self.x_padding+4, pl.y);
					self.c.restore();
					// Line
					self.c.save();
					self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
					self.c.lineWidth = '1';
					self.c.beginPath();
					self.c.moveTo(0, pl.y);
					self.c.lineTo(w-self.x_padding, pl.y);
					self.c.stroke();
					self.c.restore();
				}
			}
			if (self.min_v != null && self.max_v != null) {
				// Min max vol
				const max_vw = volume_to_w(self.max_v);
				const min_vw = volume_to_w(self.min_v);
				const vl_label = self.to_screen(new Vector(0, max_vw));
				const vh_label = self.to_screen(new Vector(0, min_vw));
				self.c.save();
				self.c.font = '12px Arial';
				self.c.fillStyle = 'rgba(0, 0, 0, 0.8)';
				self.c.fillText(number_with_commas(self.max_v.toFixed(0)), w-self.x_padding+4, vl_label.y+max_label_y_offset);
				self.c.fillText(number_with_commas(self.min_v.toFixed(0)), w-self.x_padding+4, vh_label.y+min_label_y_offset);
				self.c.restore();
				// Draw horizontal grid
				self.c.save();
				self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
				self.c.lineWidth = '1';
				self.c.beginPath();
				self.c.moveTo(0, vh_label.y);
				self.c.lineTo(w-self.x_padding, vh_label.y);
				self.c.stroke();
				self.c.beginPath();
				self.c.moveTo(0, vl_label.y);
				self.c.lineTo(w-self.x_padding, vl_label.y);
				self.c.stroke();
				self.c.restore();
			}
			if (self.min_rm != null && self.max_rm != null) {
				// Min max vol
				const max_mw = rmention_to_w(self.max_rm);
				const min_mw = rmention_to_w(self.min_rm);
				const ml_label = self.to_screen(new Vector(0, max_mw));
				const mh_label = self.to_screen(new Vector(0, min_mw));
				self.c.save();
				self.c.font = '12px Arial';
				self.c.fillStyle = 'rgba(0, 0, 0, 0.8)';
				self.c.fillText(number_with_commas(self.max_rm.toFixed(0)), w-self.x_padding+4, ml_label.y+max_label_y_offset);
				self.c.fillText(number_with_commas(self.min_rm.toFixed(0)), w-self.x_padding+4, mh_label.y+min_label_y_offset);
				self.c.restore();
				// Draw horizontal grid
				self.c.save();
				self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
				self.c.lineWidth = '1';
				self.c.beginPath();
				self.c.moveTo(0, mh_label.y);
				self.c.lineTo(w-self.x_padding, mh_label.y);
				self.c.stroke();
				self.c.beginPath();
				self.c.moveTo(0, ml_label.y);
				self.c.lineTo(w-self.x_padding, ml_label.y);
				self.c.stroke();
				self.c.restore();
			}
			if (self.min_tm != null && self.max_tm != null) {
				// Min max vol
				const max_mw = tmention_to_w(self.max_tm);
				const min_mw = tmention_to_w(self.min_tm);
				const ml_label = self.to_screen(new Vector(0, max_mw));
				const mh_label = self.to_screen(new Vector(0, min_mw));
				self.c.save();
				self.c.font = '12px Arial';
				self.c.fillStyle = 'rgba(0, 0, 0, 0.8)';
				self.c.fillText(number_with_commas(self.max_tm.toFixed(0)), w-self.x_padding+4, ml_label.y+max_label_y_offset);
				self.c.fillText(number_with_commas(self.min_tm.toFixed(0)), w-self.x_padding+4, mh_label.y+min_label_y_offset);
				self.c.restore();
				// Draw horizontal grid
				self.c.save();
				self.c.strokeStyle = 'rgba(0, 0, 0, 0.1)';
				self.c.lineWidth = '1';
				self.c.beginPath();
				self.c.moveTo(0, mh_label.y);
				self.c.lineTo(w-self.x_padding, mh_label.y);
				self.c.stroke();
				self.c.beginPath();
				self.c.moveTo(0, ml_label.y);
				self.c.lineTo(w-self.x_padding, ml_label.y);
				self.c.stroke();
				self.c.restore();
			}

			// Get mouseover y axis
			if (self.pw) {
				if (self.pw.y <= section_prices) {
					const price = w_to_price(self.pw.y);
					if (price != null && price >= 0) {
						self.c.save();
						self.c.font = '16px Arial';
						self.c.fillStyle = '#444';
						const price_str = '$'+price.toFixed(2);
						const tm = self.c.measureText(price_str);
						self.c.fillRect(w-self.x_padding, self.p.y, tm.width+10, 24);
						self.c.fillStyle = '#fff';
						self.c.fillText(price_str, w-self.x_padding+4, self.p.y+18);
						self.c.restore();
					}
				}
				else if (self.pw.y <= section_prices+section_volumes) {
					const volume = w_to_volume(self.pw.y);
					if (volume != null && volume >= 0) {
						self.c.save();
						self.c.font = '12px Arial';
						self.c.fillStyle = '#444';
						const volume_str = number_with_commas(volume.toFixed(0));
						const tm = self.c.measureText(volume_str);
						self.c.fillRect(w-self.x_padding, self.p.y, tm.width+10, 24);
						self.c.fillStyle = '#fff';
						self.c.fillText(volume_str, w-self.x_padding+4, self.p.y+16);
						self.c.restore();
					}
				}
				else if (self.pw.y <= section_prices+section_volumes+section_reddit_mentions) {
					const reddit_mentions = w_to_rmention(self.pw.y);
					if (reddit_mentions != null && reddit_mentions >= 0) {
						self.c.save();
						self.c.font = '12px Arial';
						self.c.fillStyle = '#444';
						const reddit_mentions_str = number_with_commas(reddit_mentions.toFixed(0));
						const tm = self.c.measureText(reddit_mentions_str);
						self.c.fillRect(w-self.x_padding, self.p.y, tm.width+10, 24);
						self.c.fillStyle = '#fff';
						self.c.fillText(reddit_mentions_str, w-self.x_padding+4, self.p.y+16);
						self.c.restore();
					}
				}
				else if (self.pw.y <= section_prices+section_volumes+section_reddit_mentions+section_twitter_mentions) {
					const twitter_mentions = w_to_tmention(self.pw.y);
					if (twitter_mentions != null && twitter_mentions >= 0) {
						self.c.save();
						self.c.font = '12px Arial';
						self.c.fillStyle = '#444';
						const twitter_mentions_str = number_with_commas(twitter_mentions.toFixed(0));
						const tm = self.c.measureText(twitter_mentions_str);
						self.c.fillRect(w-self.x_padding, self.p.y, tm.width+10, 24);
						self.c.fillStyle = '#fff';
						self.c.fillText(twitter_mentions_str, w-self.x_padding+4, self.p.y+16);
						self.c.restore();
					}
				}
			}

			const tw_widths = self.get_tw_widths();
			const oc_width = tw_widths['oc_width'];
			const hl_width = tw_widths['hl_width'];

			// Get mouseover x axis
			const selected_date = self.get_selected_date(tws);
			if (selected_date != null) {
				const date = selected_date;
				// Render date
				const date_str = date.getDate()+' '+MONTHS[date.getMonth()]+' '+date.getFullYear();
				self.c.save();
				self.c.font = '16px Arial';
				self.c.fillStyle = '#444';
				const tm = self.c.measureText(date_str);
				self.c.fillRect(self.p.x, h-self.y_padding, tm.width+10, 22);
				self.c.fillStyle = '#fff';
				self.c.fillText(date_str, self.p.x+4, h-14);
				self.c.restore();
			}

			// Draw charts
			for (const pair of tws) {
				const date = pair[0];
				const t = pair[1];

				for (const d of self.data) {
					if (date_eq(d['date'], date)) {
						let color = 'rgb(38, 166, 154)';
						let clear_color = 'rgba(38, 166, 154, 0.6)';
						if (d['close'] < d['open']) {
							color = 'rgb(239, 83, 80)';
							clear_color = 'rgba(239, 83, 80, 0.6)';
						}
						// const reddit_color = 'rgba(4, 150, 255, 0.6)';
						const reddit_color = 'rgba(255, 69, 0, 0.6)';
						const twitter_color = 'rgba(29, 161, 242, 0.6)';

						// Convert to world space
						let o_w = price_to_w(d['open']);
						let h_w = price_to_w(d['high']);
						let l_w = price_to_w(d['low']);
						let c_w = price_to_w(d['close']);
						let v_w = volume_to_w(d['volume']);

						// Open close prices
						const po = self.to_screen(new Vector(t-oc_width/2, o_w));
						const pc = self.to_screen(new Vector(t+oc_width/2, c_w));
						self.c.save();
						self.c.fillStyle = color;
						self.c.beginPath();
						self.c.moveTo(po.x, po.y);
						self.c.lineTo(po.x, pc.y);
						self.c.lineTo(pc.x, pc.y);
						self.c.lineTo(pc.x, po.y);
						self.c.fill();
						self.c.restore();

						// High low prices
						const ph = self.to_screen(new Vector(t-hl_width/2, h_w));
						const pl = self.to_screen(new Vector(t+hl_width/2, l_w));
						self.c.save();
						self.c.fillStyle = color;
						self.c.beginPath();
						self.c.moveTo(ph.x, ph.y);
						self.c.lineTo(ph.x, pl.y);
						self.c.lineTo(pl.x, pl.y);
						self.c.lineTo(pl.x, ph.y);
						self.c.fill();
						self.c.restore();

						// Volumes
						const v1 = self.to_screen(new Vector(t-oc_width/2, v_w));
						const v2 = self.to_screen(new Vector(t+oc_width/2, section_prices+section_volumes));
						self.c.save();
						self.c.fillStyle = clear_color;
						self.c.beginPath();
						self.c.moveTo(v1.x, v1.y);
						self.c.lineTo(v1.x, v2.y);
						self.c.lineTo(v2.x, v2.y);
						self.c.lineTo(v2.x, v1.y);
						self.c.fill();
						self.c.restore();

						// Display selected information
						if (selected_date && date_eq(d['date'], selected_date)) {
							const info_str = 'O ' + d['open'] + ' H ' + d['high'] + ' L ' + d['low'] + ' C ' + d['close'];
							self.c.save();
							self.c.font = 'bold 14px Arial';
							self.c.fillStyle = color;
							self.c.fillText(info_str, 12, 48);
							self.c.restore();
						}

						// reddit_mentions
						if (d.hasOwnProperty('reddit_mentions')) {
							let m_w = rmention_to_w(d['reddit_mentions']);
							const m1 = self.to_screen(new Vector(t-oc_width/2, m_w));
							const m2 = self.to_screen(new Vector(t+oc_width/2, section_prices+section_volumes+section_reddit_mentions));
							self.c.save();
							self.c.fillStyle = reddit_color;
							self.c.beginPath();
							self.c.moveTo(m1.x, m1.y);
							self.c.lineTo(m1.x, m2.y);
							self.c.lineTo(m2.x, m2.y);
							self.c.lineTo(m2.x, m1.y);
							self.c.fill();
							self.c.restore();
						}

						// twitter_mentions
						if (d.hasOwnProperty('twitter_mentions')) {
							let m_w = tmention_to_w(d['twitter_mentions']);
							const m1 = self.to_screen(new Vector(t-oc_width/2, m_w));
							const m2 = self.to_screen(new Vector(t+oc_width/2, section_prices+section_volumes+section_reddit_mentions+section_twitter_mentions));
							self.c.save();
							self.c.fillStyle = twitter_color;
							self.c.beginPath();
							self.c.moveTo(m1.x, m1.y);
							self.c.lineTo(m1.x, m2.y);
							self.c.lineTo(m2.x, m2.y);
							self.c.lineTo(m2.x, m1.y);
							self.c.fill();
							self.c.restore();
						}
					}
				}
			}

			// Company information
			const info_str = self.info['short_name'] + ' · ' + self.info['exchange'] + ' · ' + self.info['sector'] + ' · ' + self.info['industry'];
			self.c.save();
			self.c.font = '18px Arial';
			self.c.fillStyle = '#222';
			self.c.fillText(info_str, 12, 28);
			self.c.restore();
		}
	}

	animate_scroll(speed=0.01) {
		const self = this;
		clearInterval(self.anim);
		self.resume_scroll(speed);
	}

	resume_scroll(speed=0.01) {
		const self = this;
		const max_tw = 1-self.padding_w.x;
		const spacing = max_tw/self.n_ts;
		let stop_at = null;
		if (self.dates != null)
			stop_at = max_tw + spacing*self.dates.length - 2.0+self.padding_w.x*4;
		self.anim = setInterval(function () {
			self.camera.x += speed;
			// console.log(self.camera.x);
			if (stop_at && self.camera.x >= stop_at)
				clearInterval(self.anim);
			self.render();
		}, 50);
	}

	pause_scroll() {
		const self = this;
		clearInterval(self.anim);
	}

	scroll_to(x, speed=0.05) {
		const self = this;
		is_paused = false;
		self.as = setInterval(function () {
			if (self.camera.x < x) {
				self.camera.x += speed;
				if (self.camera.x >= x) {
					is_paused = true;
					clearInterval(self.as);
				}
			}
			if (self.camera.x > x) {
				self.camera.x -= speed;
				if (self.camera.x <= x) {
					is_paused = true;
					clearInterval(self.as);
				}
			}
			self.render();
		}, 50);

		// const max_tw = 1-self.padding_w.x;
		// const spacing = max_tw/self.n_ts;
		// let t = max_tw + spacing*self.dates.length - 2-self.padding_w.x*4;
		// for (const i in self.dates) {
		// 	const d1 = self.dates[i];
		// 	t -= spacing;
		// 	if (date_eq(date, d1))
		// 		stop_at = t;
		// 	// console.log(t);
		// }
		// console.log(stop_at);

		// const max_tw = 1-self.padding_w.x;
		// const spacing = max_tw/self.n_ts;
		// if (self.dates != null) {
		// 	for (const i in self.dates) {
		// 		const d = self.dates[i];
		// 		if (date_eq(date, self.dates[i]))
		// 			stop_at = max_tw + spacing*self.dates.length - 2.0+self.padding_w.x*2;
		// 	}
		// 	console.log(max_tw, spacing);
		// }

		// const rev = stop_at < self.camera.x;
		// self.anim = setInterval(function () {
		// 	is_paused = false;
		// 	if (rev) {
		// 		self.camera.x -= speed;
		// 		if (stop_at && self.camera.x <= stop_at) {
		// 			clearInterval(self.anim);
		// 			is_paused = true;
		// 		}
		// 	}
		// 	else {
		// 		self.camera.x += speed;
		// 		if (stop_at && self.camera.x >= stop_at) {
		// 			clearInterval(self.anim);
		// 			is_paused = true;
		// 		}
		// 	}
		// 	console.log(self.camera.x.toFixed(2), '\n', stop_at.toFixed(2));
		// 	self.render();
		// }, 50);
	}
}

class Story {
	constructor() {
		const self = this;
		self.messages = [
			'The financial market and its connection to social media is difficult to understand without streamlined access to big data and analytic tools.',
			'With the recent events surrounding GameStop (GME), we aim to explore the relationships between social media and Wall Street using combined data from Reddit, Twitter, and Yahoo Finance.',
			'GameStop closed more than 300 stores in 2019, and hundreds more in 2020. Due to its mass closings, experts believed that GameStop was headed for bankruptcy.',
			'However, recent fluctuations in the price of its stock might just save it. So, what gives?',
			'At a quick glance, we can see that the number of times that GME is mentioned on social media is closely aligned with GME\'s price in January.',
			'Let\'s check if we can observe similar relationships throughout its history.',
			'In mid September of 2020, we observe spikes in social media activity as the price of GME begins to rise rapidly.',
			'However, it isn\'t always the case that price and mentions correlate, as you can see during mid-March of 2020. Nevertheless, during this time, we observe increased volatility.',
			'There are also periods where the number of mentions diverge between users of Reddit and Twitter.',
			'To better understand the sentiments of social media users, we can refer to this table which selects the top rated posts for Reddit or Twitter between the dates visible in this chart.',
			'The colors of the rows indicate a prediction by a classification model that compares two sentences and decides if they entail or contradict.',
			'In our case, we compare the content of the social media post with the following phrase: "GME is a good choice. The price of GME will increase." Contradicting statements are highlighted in red, and entailing statements in blue.',
			'We can gain insight into the nature of the anomaly through qualitative analysis of a post. Here, a user blames the SEC for the sudden drop in price in early February.',
			'Using these dropdowns, we can select the social media platform to display in the table and in the word cloud.',
			'Here, you can query our database to explore the dataset we\'ve created.',
			'As part of our analysis, we classified social media posts into phrase and token-level classes, and we hope to add more so that we can further explore the relationship between the stock market and social media.',
		];
		self.max = self.messages.length;

		self.$tutorial_message = $('.tutorial_message');
		self.$message = self.$tutorial_message.find('.message');

		self.resized();
		window.addEventListener('resized', function () {
			if (!$('.chart_container').hasClass('active'))
				return;
			self.resized.apply(self);
			self.step();
		}, false);

		// Tutorial buttons
		self.$next_button = $('#next_tutorial');
		self.$skip_button = $('#skip_tutorial');
		self.$next_button.on('click', function () {
			self.progress++;
			self.step.apply(self);
		});
		self.$skip_button.on('click', function () {
			self.progress = self.max;
			self.step.apply(self);
		});

		// Scroll animation
		const $start_button = $('#start_story');
		const $reset_button = $('#reset_story');
		$start_button.on('click', function () {
			if (is_paused) {
				chart.resume_scroll();
				$start_button.val('Pause');
			}
			else {
				chart.pause_scroll();
				$start_button.val('Resume');
			}
			is_paused = !is_paused;
			chart.render();
		});
		$reset_button.on('click', function () {
			is_paused = true;
			chart.camera = new Vector(0, 0);
			chart.pause_scroll();
			chart.render();
			$start_button.val('Start');
		});
	}

	resized() {
		const self = this;
		self.width = $(window).width();
		self.height = $(window).height();
		// self.move_message_to(null, self.width/2, self.height/2);
	}

	start() {
		const self = this;
		self.progress = 0;
		self.$tutorial_message.css('display', 'block');
		self.move_message_to('#chart_canvas');
		self.step();
	}

	skip() {
		const self = this;
		self.progress = -1;
		$('#chart_type_select').prop('disabled', false);
		$('.collapse_view_button .icon').text('>');
		$('.editor_view').removeClass('horizontal_collapsed');
		$('#ticker_select').prop('disabled', false);
		$('#chart_type_select').prop('disabled', false);

		$('.tutorial_message_container').css('display', 'none');
		$('.tutorial_step .shaded_overlay').css({
			'display': 'none',
			'backdrop-filter': 'none',
		});
	}

	step() {
		const self = this;
		console.log(self.progress);

		if (self.progress >= self.max)
			self.skip();

		self.display_message(self.messages[self.progress]);

		if (self.progress === 3)
			chart.resume_scroll(0.05);
		if (self.progress === 4) {
			const $elem = $('#chart_canvas');
			const offset = $elem.offset();
			self.$tutorial_message.css({
				'top': $(window).height() - 40,
				'left': offset.left + $elem.width() - 40,
				'-ms-transform': 'translate(0, -100%)',
				'transform': 'translate(0, -100%)',
			});
		}
		if (self.progress === 6) {
			chart.scroll_to(1.683);
		}
		if (self.progress === 7) {
			chart.scroll_to(0.234);
		}
		if (self.progress === 8) {
			chart.scroll_to(0.860);
		}
		if (self.progress === 9) {
			chart.scroll_to(2.514);
			// chart.scroll_to(0.234);
			self.move_message_to('#word_table_container', -self.$tutorial_message.width()*1.5, 0);
		}
		if (self.progress === 12) {
			// chart.scroll_to(2.514);
			self.$tooltip = $('#word_table_container tbody tr:first .tooltip')
				.css({
					'color': '#fff',
					'background-color': 'rgba(50, 50, 50, 0.8)',
					'opacity': 1,
					'max-height': '300px',
				});
			// console.log(self.$tooltip);
		}
		if (self.progress === 13) {
			self.$tooltip
				.css({
					'color': '#000',
					'background-color': 'rgba(240, 240, 240, 0.8)',
					'opacity': 0,
					'max-height': '150px',
				});
			self.move_message_to('#word_table_container');
		}
		if (self.progress === 14) {
			setTimeout(function () {
				self.move_message_to('#data_table_container');
			}, 1000);
			$('.active').removeClass('active');
			$('[data-target=".database_container"]').addClass('active');
			$('.database_container').addClass('active');
			editor.editor.update_gui();
		}
		if (self.progress === 15) {
			$('.collapse_view_button .icon').text('<');
			$('.editor_view').addClass('horizontal_collapsed');
			setTimeout(function () {
				// Execute sql command
				dataset.request_cmd = editor.editor.get_text();
				window.dispatchEvent(request_update_event);
			}, 500);
		}
		// chart.scroll_to(new Date(2021, 1, 1));
	}

	display_message(message) {
		const self = this;
		if (self.message_animation)
			clearInterval(self.message_animation);
		self.$message.empty();
		const $paragraph = $('<div>')
			.appendTo(self.$message)
			.addClass('paragraph');
		const $span = $('<span>').appendTo($paragraph)
			.text(message)
			.hide()
			.fadeIn(3000);
	}

	move_message_to(id=null, dx=10, dy=10) {
		const self = this;
		if (id == null) {
			// Move to center
			self.$tutorial_message.css({
				'top': '50%',
				'left': '50%',
				'-ms-transform': 'translate(-50%, -50%)',
				'transform': 'translate(-50%, -50%)',
			});
		}
		else {
			// Move to offset of element
			const $elem = $(id);
			const offset = $elem.offset();
			self.$tutorial_message.css({
				'top': offset.top + dy,
				'left': offset.left + dx,
				'-ms-transform': 'translate(0, 0)',
				'transform': 'translate(0, 0)',
			});
		}
	}
}

class Cloud {
	constructor() {
		const self = this;
		self.parent_id = 'word_cloud_container';
		self.svg_id = 'word_cloud_svg';
		self.g_id = 'word_cloud_g';
		self.$parent = $('#'+self.parent_id);
		self.$svg = $('#'+self.svg_id);
		self.$g = d3.select('#'+self.g_id);
		self.cloud = d3.layout.cloud()
			// .spiral('archimedean')
			// .padding(20)
			.font('Impact')
			.rotate(function () {
				return ~~(Math.random() * 2) * 90;
			})
			.fontSize(function (d) {
				if (d.size > 350)
					return 350;
				return d.size;
			})
			.on('end', self.on_end.bind(self));

		self.cache = {};

		self.resized();
		self.render();
		window.addEventListener('resized', function () {
			if (!$('.chart_container').hasClass('active'))
				return;
			self.resized.apply(self);
			self.render.apply(self);
		}, false);
	}

	set_words(words, cache_key=null) {
		console.log(cache_key);
		const self = this;
		if (cache_key && self.cache.hasOwnProperty(cache_key)) {
			// console.log('USE CACHE');
			self.on_end(self.cache[cache_key]);
		}
		else {
			self.cache_key = cache_key;
			self.cloud.words(words);
			self.render();
		}
		self.words = words;
	}

	resized() {
		const self = this;
		self.width = self.$parent.width();
		self.height = self.$parent.height();
		self.$svg
			.attr('width', self.width)
			.attr('height', self.height);
		self.$g
			.attr('width', self.width)
			.attr('height', self.height)
			.attr('transform', 'translate(' + self.width/2 + ',' + self.height/2 + ')');
		self.cloud.size([self.width, self.height]);
	}

	render() {
		const self = this;
		// return new Promise(function (resolve, reject) {
		// 	self.cloud.stop.apply(self);
		// 	self.cloud.start.apply(self);
		// });
		self.cloud.stop();
		self.cloud.start();
	}

	on_end(words) {
		const self = this;

		if (self.cache_key)
			self.cache[self.cache_key] = words;

		if (words && words.length > 0)
			$loading2.fadeOut(200);

		self.$g.selectAll('text').remove();
		self.$g.selectAll('text')
			.data(words)
			.enter()
				.append('text')
				.attr('text-anchor', 'middle')
				.style('font-family', 'Impact')
				.style('font-size', function (d) {
					return d.size + 'px';
				})
				.style('fill', function (d, i) {
					return colors[i%colors.length];
				})
				.attr('transform', function (d) {
					return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
				})
				.text(function (d) {
					return d.text;
				});
		self.$g
			.attr('width', self.width)
			.attr('height', self.height)
			.attr('transform', 'translate(' + self.width/2 + ',' + self.height/2 + ')');
	}
}

class WordTable {
	constructor() {
		const self = this;
		self.$table = $('#word_table');
		self.data = {};
		self.requested = {};
		self.type = 'Reddit';
	}

	set_data(data) {
		const self = this;
		self.data = data;
	}

	get_top_post_command(symbol, to, from) {
		const self = this;
		let order_by;
		let cmp;
		if (self.type == 'Reddit') {
			order_by = 'score';
			cmp = `subreddit = "wallstreetbets"`;
		}
		else if (self.type == 'Twitter') {
			order_by = 'favorite_count';
			cmp = `user_followers_count > 100 AND symbols LIKE "%${symbol}%"`;
		}
		const limit = 100;
		from = datetime_to_string(from, true);
		to = datetime_to_string(to.add_days(1), true);
		const cmd =
			`SELECT	*
				FROM ${self.type}_${symbol}
				WHERE datetime > "${from}" AND datetime < "${to}" AND ${cmp}
				ORDER BY ${order_by} DESC
				LIMIT ${limit}`;
		return cmd;
	}

	get_data(symbol, from, to) {
		const self = this;

		// Cache for select change
		self.symbol = symbol;
		self.from = from;
		self.to = to;

		return new Promise(function (resolve, reject) {
			if (self.data.hasOwnProperty(from)) {
				return resolve(self.data[from]);
			}
			else if (!self.requested[from]) {
				execute(self.get_top_post_command(symbol, from, to))
					.then(function (res) {
						// console.log(res);
						self.requested[from] = true;
						self.data[from] = res.value;
						resolve(res.value);
					});
			}
		});
	}

	show(date) {
		const self = this;
		clearTimeout(self.show_timer);
		self.show_timer = setTimeout(function () {
			const data = self.data[date];
			// self.$table.fadeOut(200, self.update.bind(self, data));
			self.update(data);
		}, 200);
	}

	update(data) {
		const self = this;
		self.$table.empty();
		if (!data || data.length == 0)
			return;

		// self.$table.fadeIn(200);
		const all_keys = [
			'datetime',

			'body',
			'author',
			'score',
			'subreddit',

			'full_text',
			'favorite_count',
			'retweet_count',
			'reply_count',
			'user_followers_count',
			'user_friends_count',
			'lang',
			'user_name',
			'user_screen_name',
		];

		const pos_color = 'rgba(55, 184, 233, 0.3)';
		const neg_color = 'rgba(240, 105, 80, 0.3)';

		const keys = [];
		for (const k of all_keys)
			if (data[0].hasOwnProperty(k))
				keys.push(k);

		const $thead = $('<thead>').appendTo(self.$table).addClass('thead');
		const $row = $('<tr>').appendTo($thead);
		for (const k of keys) {
			const $th = $('<th>').appendTo($row).html(k);
		}

		const $tbody = $('<tbody>').appendTo(self.$table).addClass('tbody');
		for (const row of data) {
			const $row = $('<tr>').appendTo($tbody);
			for (const k of keys) {
				const $td = $('<td>').appendTo($row);
				const $cell = $('<div>').appendTo($td).addClass('cell').text(row[k]);
				$('<div>').appendTo($td).addClass('tooltip').text(row[k]);
			}
			if (row['sa_roberta_entailment'] > (row['sa_roberta_contradiction'] + row['sa_roberta_neutral']))
				$row.css('background', pos_color);
			else if (row['sa_roberta_contradiction'] > (row['sa_roberta_entailment'] + row['sa_roberta_neutral']))
				$row.css('background', neg_color);
		}
	}
}

let story;
function initialize_ui() {
	table = new Table();
	editor = new Editor();
	chart = new Chart();
	story = new Story();
	// story.start();

	// Initialize tab contents
	const $tabs = $('.tabs .tab');
	$tabs.each(function (_, elem) {
		const $this = $(elem);
		const $target = $($this.attr('data-target'));
		$target.addClass('tab_content');
		// Activate tab content
		if ($this.hasClass('active'))
			$target.addClass('active');
	});

	// Listen for tab switching event
	$('.tab').on('click', function () {
		const $this = $(this);
		const $target = $($this.attr('data-target'));
		// Deactivate all sibling tabs
		const $siblings = $this.siblings('.tab');
		$siblings.each(function (i, e) {
			const $tab = $(this);
			const $tab_target = $($tab.attr('data-target'));
			$tab.removeClass('active');
			$tab_target.removeClass('active');
		});
		// Activate the selected tab and its target content
		$this.addClass('active');
		$target.addClass('active');
		// editor.editor.update_gui();
		window.dispatchEvent(resized_event);
	});

	// Window resized
	const $window = $(window);
	let window_width = $window.width();
	let window_height = $window.height();
	setInterval(function () {
		const width = $window.width();
		const height = $window.height();
		if (window_width !== width || window_height !== height) {
			window_width = width;
			window_height = height;
			window.dispatchEvent(resized_event);
		}
	}, 1000);
}

$(function () {
	$loading1 = $('#loading1');
	$loading2 = $('#loading2');
	$table = $('#data_table');

	// Worker
	worker = new Worker('worker.js');
	worker.onmessage = function (e) {
		const data = e.data;
		// console.log('main:', data);

		if (data.name == 'start_update') {
			on_start_update(data.res);
			is_querying = true;
		}

		else if (data.name == 'update') {
			on_update(data.res);
			is_querying = false;

			// setTimeout(function () {
			// 	story.start();
			// }, 1000);
		}

		else if (data.name == 'scroll') {
			on_table_scroll(data.res);
		}

		else if (data.name == 'words') {
			chart.all_words = data.res.all_words;
			chart.agg_words = data.res.agg_words;
			chart.agg_type_words = data.res.agg_type_words;
			chart.agg_type_count = data.res.agg_type_count;

			chart.resized();
			chart.render();
			chart.cloud.resized();

			$('#loading2').css('display', 'block');
			$('.overlay').fadeOut(500);

			setTimeout(function () {
				story.start();
			}, 1000);
		}
	};

	initialize_ui();

	// Dataset started updating
	let marked_time = 0;
	function on_start_update(_dataset) {
		dataset = _dataset;

		$loading1.show();
		$table.fadeOut(250);

		marked_time = Date.now();
		editor.log({
			type: 'query',
			timestamp: marked_time,
			took: 0,
			values: [{
				data: dataset.cmd,
				type: 'string',
				name: 'String',
			}],
		});
	}

	// Dataset finished updating
	function on_update(_dataset) {
		dataset = _dataset;

		chart.set_tickers(dataset.tables);

		$loading1.hide();
		$table.fadeIn(250);

		$('#reset_query_button').hide();
		if (dataset.is_custom_cmd)
			$('#reset_query_button').show();

		// Update table
		if (dataset.result.status == 'success')
			table.update();

		// Update editor
		let values = null;
		let type;
		let truncated = false;
		if (dataset.result.status == 'success') {
			type = 'response';
			truncated = dataset.result.truncated;
			values = array_to_json([dataset.result.value]);
		}
		else if (dataset.result.status == 'illegal') {
			type = 'error';
			values = [{data: dataset.result.value, type: 'string', name: 'String',}];
		}
		else if (dataset.result.status == 'error') {
			type = 'error';
			let message = '';
			message += 'code: ' + dataset.result.value.code + '\n';
			message += 'errno: ' + dataset.result.value.errno + '\n';
			message += 'sqlMessage: ' + dataset.result.value.sqlMessage + '\n';
			message += 'sqlState: ' + dataset.result.value.sqlState + '\n';
			message += 'index: ' + dataset.result.value.index + '\n';
			message += 'sql: ' + dataset.result.value.sql;
			values = [{data: message, type: 'string', name: 'String',}];
		}
		else {
			type = 'log';
			values = array_to_json([dataset.result.value]);
		}
		const returned_time = Date.now();
		editor.log({
			type: type,
			timestamp: returned_time,
			took: returned_time - marked_time,
			truncated: truncated,
			values: values,
		});
	}

	// Calculations for table cell backgrounds
	function on_table_scroll(stats) {
		// $('.cell').css('background', 'transparent');
		for (const i in table.$view_rows) {
			const $r = table.$view_rows[i];
			const r = table.view_rows[i];
			for (const k of table.keys) {
				const $cell = $r[k];
				$cell.css(table.get_style(r, k, stats));
			}
		}
	}

	// Request dataset to update
	function request_update() {
		let args = null;
		if (dataset != null) {
			args = {
				'page': dataset.page,
				'table': dataset.table,
				'cmd': dataset.request_cmd,
			};
		}
		worker.postMessage({
			'name': 'request_update',
			'fn': 'request_update',
			'args': args,
		});
	}
	// dataset = {};
	request_update();
	chart.get_data();

	window.addEventListener('request_update', function () {
		console.log('request_update');
		request_update();
	}, false);

	// Bind ctrl + s
	$(window).bind('keydown', function(event) {
		if (event.ctrlKey || event.metaKey) {
			switch (String.fromCharCode(event.which).toLowerCase()) {
				case 's':
					event.preventDefault();
					if (is_querying)
						return;
					dataset.request_cmd = editor.editor.get_text.apply(editor.editor);
					window.dispatchEvent(request_update_event);
					break;
			}
		}
	});

	// TODO: move to worker
	get_estimate().then(function (res) {
		let progress = 0;
		let tot_rows = 0;
		let tot_size = 0;
		for (const k in res) {
			if (progress == 0)
				progress = res[k]['progress'];
			if (progress > res[k]['progress'])
				progress = res[k]['progress'];
			tot_rows += Math.floor(res[k]['rem_rows']);
			tot_size += Math.floor(res[k]['rem_size']);
		}
		$('.now_perc').text((progress*100) + '%');
		$('.rem_rows').text(number_with_commas(tot_rows));
		$('.rem_size').text(number_with_commas((tot_size/1024/1024/1024).toFixed(2)));
	});
});
