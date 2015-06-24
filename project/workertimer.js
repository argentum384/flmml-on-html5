!function () {
	var idTable = {};

	function onTimer(id) {
		postMessage(id);
	}

	onmessage = function (e) {
		var data = e.data,
			id = data.id,
			interval = data.interval;

		if (interval) // set
			idTable[id] = setInterval(onTimer.bind(this, id), interval);
		else // clear
			clearInterval(idTable[id]);
	};
}();
