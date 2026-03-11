'use strict';

$(document).ready(function() {

	// Bar chart
	
	if ($('#bar').length > 0) {
	var optionsBar = {
		chart: {
			type: 'bar',
			height: 350,
			width: '100%',
			stacked: false,
			toolbar: {
				show: false
			},
		},
		dataLabels: {
			enabled: false
		},
		plotOptions: {
			bar: {
				columnWidth: '55%',
			},
		},
		stroke: {
			show: true,
			width: 3,
			colors: ['transparent']
		},
		series: [{
			color: '#AAF40C',
			data: [420, 532, 516, 575, 519, 517, 454, 392, 262, 383, 446, 551],
		}, {
			color: '#097E52',
			data: [336, 612, 344, 647, 345, 563, 256, 344, 323, 300, 455, 456],
		}],
		labels: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020],
		xaxis: {
			labels: {
				show: false
			},
			axisBorder: {
				show: false
			},
			axisTicks: {
				show: false
			},
		},
		yaxis: {
			axisBorder: {
				show: false
			},
			axisTicks: {
				show: false
			},
			labels: {
				style: {
					colors: '#777'
				}
			}
		},
		title: {
			text: '',
			align: 'left',
			style: {
				fontSize: '18px'
			}
		}

	}
  
	var chartBar = new ApexCharts(document.querySelector('#bar'), optionsBar);
	chartBar.render();
	}

// Radial Chart
if($('#radial-chart').length > 0 ){
	var radialChart = {
		chart: {
			height: 250,
			type: 'radialBar',
			toolbar: {
			  show: false,
			}
		},
		colors: ['#AAF40C', '#097E52'],  
		plotOptions: {
			radialBar: {
				dataLabels: {
					name: {
						fontSize: '14px',
					},
					value: {
						fontSize: '20px',
					},
					total: {
						show: true,
						label: 'Total Earnings',
						formatter: function (w) {
							return 4050
						}
					}
				}
			}
		},
		series: [44, 55],
		labels: ['Cages', 'Coaching'],  
	}
	
	var chart = new ApexCharts(
		document.querySelector("#radial-chart"),
		radialChart
	);
	
	chart.render();
	}
  
});
