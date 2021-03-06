define(['lodash','authentication'], function(_) {
	return ['$scope', '$http', '$timeout', '$location', '$q', function ($scope, $http, $timeout, $location, $q) {

		$scope.requests = [];
		$scope.refresh  = refresh;
		$scope.sum      = sum;
		$scope.distinct = distinct;
		$scope.getFromLast      = getFromLast;
		$scope.isPending        = function(r) { return  is(r, 'pending' ); };
		$scope.isPendingHeld    = function(r) { return  is(r, 'pending-held' ); };
		$scope.isProcessing     = function(r) { return  is(r, 'processing' ); };
		$scope.isProcessingStop = function(r) { return  is(r, 'processing-stopped' ); };
		$scope.isCompleted      = function(r) { return  is(r, 'completed' ); };
		$scope.isCanceled       = function(r) { return  is(r, 'canceled' ); };
		$scope.isAborted        = function(r) { return  is(r, 'aborted' ); };
		$scope.isCleared        = function(r) { return  is(r, 'cleared' ); };
		$scope.isDay            = function(d, upto) { return function(r) { return r.createdOn.indexOf(d)===0 || (upto && r.createdOn.substr(0,10)<d) } };

		var qAutoRefresh = null;

		$scope.$on('$routeChangeStart', function() {
			if(!qAutoRefresh)
				return;

			console.log('Canceling autoRefresh');

			$timeout.cancel(qAutoRefresh);

			qAutoRefresh = null;
		});

		$scope.$watch(function() { return $location.path(); }, function(path) {

			if(path != "/") {
				$scope.badge = "";
				$scope.$root.contact = null;
			}
		});

		autoRefresh();

		function autoRefresh() {

			qAutoRefresh = null;

			refresh();

			qAutoRefresh = $timeout(autoRefresh, 30*1000);
		}

		function refresh() {

            $scope.loading = {
                downloads : true,
                prints : true
            }

            var r1, r2;

			r1 = $http.get("/api/v2014/printsmart-requests", { params : { badge : $location.search().badge } }).then(function(res){

				$scope.requests = res.data;

			}).catch(function(err) {

                if(err.status==403){
                    $location.url('/403');
                    return;
                }

                console.error(err.data||err);

            }).finally(function(){

                delete $scope.loading.prints;

            });

			r2 = $http.get("/api/v2014/printsmart-downloads", { params : { badge : $location.search().badge } }).then(function(res){

                var downloads = res.data;

				var totalDownloads = 0;

				_.each(downloads, function(d){
					totalDownloads += d.items.length * (d.downloads||0);
				});

				$scope.totalDownloads = totalDownloads;

            }).catch(function(err) {

                if(err.status==403){
                    $location.url('/403');
                    return;
                }

                console.error(err.data||err);

            }).finally(function(){

                delete $scope.loading.downloads;

            });

            $q.all([r1, r2]).finally(function(){

                delete $scope.loading;

            }).then(function(){

                $scope.days = _($scope.requests).map(function(r){

                    return r.createdOn.substr(0,10);

                }).uniq().sortBy().value();
            });
		}

		$scope.averageJobTime = function(slot, last) {

			var requests = $scope.requests;

			requests  = _.filter(requests, function(r) { return r && r.status && r.status[slot]; });
			requests  = requests.splice  (requests.length-11, last);

			return sum(_.map(requests, function(r) {
					return r.status[slot] - r.status['time-at-creation'];
			})) / requests.length;
		};

		function is(request, status) {

			if(status=="cleared") {
				return request &&
					   request.completed;
			}

			return request &&
				   request.status &&
				   request.status['job-state'] === status;
		}

		function getFromLast(minutes) {

			var time = new Date();

			time.setMinutes(time.getMinutes()-minutes);

			var sTime = formatDate(time);

			 return _.filter($scope.requests, function(r) {

				return r && r.createdOn && r.createdOn > sTime;

			});
		}


		function distinct(value, member1, member2, member3, member4, member5) {

			if(value===undefined) return [];
			if(value===null)      return [];

			var values = [];

			if(_.isArray(value)) {

				_.each(value, function(entry) {

					if(member1)
						values = _.union(values, distinct(entry[member1], member2, member3, member4, member5));
					else if(value!==undefined && value!==null)
						values = _.union(values, value);
				});

			}
			else if(member1)
				values = _.union(values, distinct(value[member1], member2, member3, member4, member5));
			else
				values = _.union(values, [value]);

			return _.uniq(values);
		}

		function sum(value, member1, member2, member3, member4, member5) {

			if(value===undefined) return 0;
			if(value===null)      return 0;

			var total = 0;

			if(_.isArray(value)) {

				_.each(value, function(entry) {

					if(member1)
						total += sum(entry[member1], member2, member3, member4, member5);
					else if(_.isNumber(entry))
						total += entry;
				});
			}
			else if(member1) {
				total += sum(value[member1], member2, member3, member4, member5);
			}
			else if(_.isNumber(value)) {
				total += value;
			}

			return total;
		}

		//============================================================
	    //
	    //
	    //============================================================
	    function formatDate(date) {

	        var pad = function(s) { s = ''+s; return s.length<2 ? '0'+s : s; };

	        return pad(date.getUTCFullYear())+'-'+
	               pad(date.getUTCMonth()+1) +'-'+
	               pad(date.getUTCDate())     +'T'+
	               pad(date.getUTCHours())   +':'+
	               pad(date.getUTCMinutes()) +':'+
	               pad(date.getUTCSeconds()) +'.000Z';
	    }
	}];
});
