function reloadPlot() {
   var now = new Date();

   document.images['graph'].src = 'plot.png?' + now.getTime();

   // Start new timer (1 sec)
   timeoutID = setTimeout('reloadGraph()', 5000);
}
