/* globals escape: false */
define(['lodash', 'angular', 'moment', 'keymaster', 'app', 'directives/checkbox'], function(_, angular, moment, key) {

	return ["$scope", "$route", "$location", "$http", "$q", "growl", function ($scope, $route, $location, $http, $q, growl) {

		var location = $route.current.params.location || '';

		$scope.location  = location;
		$scope.toCommit  = toCommit;
		$scope.commit    = commit;
		$scope.capitalize= capitalize;
		$scope.flag      = flag;
		$scope.badge     = null;
		$scope.languages = {
			"ar" : "العربية / Arabic" ,
			"en" : "English" ,
			"es" : "Español / Spanish" ,
			"fr" : "Français / French" ,
			"ru" : "Русский / Russian" ,
			"zh" : "中文 / Chinese"
		};

        key('ctrl+esc', function(){
            var requests = _.filter($scope.allRequests, toCommit);

            if(requests.length) commit(requests, true);
            else                close();
        });


        $scope.$on('$destroy', function(){
            key.unbind('ctrl+esc');
        });

		load($route.current.params.badge);

        //=============================================
		//
		//
		//=============================================
        $scope.timeAgo = function(date){

            if(!date)
                return "";

            return moment(date).fromNow();

        };

		//=============================================
		//
		//
		//=============================================
		function load(badge) {

			$scope.boxes    = null;
			$scope.error    = null;
			$scope.loading  = true;
			$scope.$root.contact = null;

			var qRequests = null;

			if(badge=="boxes") {

				var q = { 
					completed: false,
					location: location
				};

				if(!q.location) 
					delete q.location;

				qRequests = $http.get('/api/v2014/printsmart-requests', { params : { q : q } });
			}
			else {

				qRequests = $http.get('/api/v2014/kronos/badges/'+escape(badge)).then(function(res) {

					return res.data;

				}).then(function(badgeInfo) {

					$scope.$root.contact = badgeInfo;

					return $http.get('/api/v2014/printsmart-requests', { params : { q : { participant : badgeInfo.ContactID, completed:false } } });

				}).then(function(res){

					var qBoxes = _.uniq(_.pluck(res.data, 'box'));

					if(qBoxes.length) // show all requests in the box(es)
						return $http.get('/api/v2014/printsmart-requests', { params : { q : JSON.stringify({ box : { $in : qBoxes }, completed:false }) } });
					else
						return res;
				});
			}


			qRequests.then(function(res) {

				var requests = res.data;

				if($scope.$root.contact) { // flag ready for clear

					_.each(requests, function(r){
						if(r.printedOn && r.participant == $scope.$root.contact.ContactID && r.location == location)
							flag(r, true);
					});
				}

				var qBoxGroup = _.groupBy(res.data, function(r){
					return r.participant +'|'+ r.box;
				});


				var boxes = _.map(qBoxGroup, function(requests) {
					var request = _.first(requests)
					return {
						box:      request.box,
						location: request.location||'',
						enabled: (request.location||'') == location,
						participant:     request.participant,
                        participantName: request.participantName,
						participantInitials: initials(request.participantName),
						requests: requests
						
					};
				});

				$scope.allRequests = requests;
				$scope.boxes       = _.sortBy(boxes, function(b){

					var prefix = (b.location==location) ? 'A_' : 'Z_';

					if($scope.$root.contact && $scope.$root.contact.ContactID == b.participant)
						prefix = '0_' + prefix; // Put current user at first

					return prefix+b.box+b.participantName;
				});

				$scope.loading = false;

			}).catch(function(err) {

				console.log("error", err);
				$scope.loading = false;
				$scope.error = err;

				angular.element("#close").focus();
			});
		}

        $scope.selectAll = function(box, select) {
            box.requests.forEach(function(r){
                $scope.flag(r, select);
            });
        };

		//=============================================
		//
		//
		//=============================================
		$scope.jobStatus = function (request) {
			var status = request.status ? request.status['job-state'] || 'pending' : 'pending';

			console.log(status);
			return status;
		};

		//=============================================
		//
		//
		//=============================================
		function initials(name) {
            return _.map((name||"").toUpperCase().split(' '), function(n){
                return n[0];
            }).join('');
		}

		//=============================================
		//
		//
		//=============================================
		function flag(request, value) {
			request.completed = (!!value || !!request.deliveredOn);
		}

        //=============================================
		//
		//
		//=============================================
		function toCommit(request) {

			return request.completed && !request.deliveredOn;
		}

		//=============================================
		//
		//
		//=============================================
		function commit(requests, closeOnSuccess) {

			var qPromises  = [];
			var errorCount = 0;

			_.each(requests, function(request) {

				request.loading = true;

				qPromises.push($http.post('/api/v2014/printsmart-requests/'+request._id+'/deliveries', {}).then(function(res) {

					delete request.loading;

					_.extend(request, res.data);

				}).catch(function(err){

					errorCount++;

					delete request.loading;

					growl.addErrorMessage("Error with document: "+request.documentSymbol);

					console.log(err);

				}));
			});

			$q.all(qPromises).then(function(){

				if(!errorCount)
				{
					growl.addSuccessMessage(''+requests.length+' document(s) cleared!', {ttl: 2000});

					if(closeOnSuccess)
						close();
				}
			});
		}

		//=============================================
		//
		//
		//=============================================
		$scope.printed = function (r) {
			return !!r.printedOn;
		};

		//=============================================
		//
		//
		//=============================================
		$scope.fixDate = function (dt) {
			return dt ? new Date(dt) : dt;
		};

		//=============================================
		//
		//
		//=============================================
        $scope.displayText = function(d) {
            return /^[A-Z0-9]{24}$/i.test(d.documentSymbol) ? d.documentTitle : d.documentSymbol;
        };

		//=============================================
		//
		//
		//=============================================
        function close() {
            $location.url("/"+encodeURIComponent(location||''));
        }

		//=============================================
		//
		// ERRORS
		//
		//=============================================
		$scope.isNotAuthorized = function() {
			return $scope.error &&
				   $scope.error.status==403;
		};

		$scope.isBadgeInvalid = function() {
			return $scope.error &&
				   $scope.error.data &&
				   $scope.error.data.error=='INVALID_BADGE_ID';
		};

		$scope.isOtherError = function() {
			return $scope.error &&
				  !$scope.isNotAuthorized() &&
				  !$scope.isBadgeInvalid();
		};

		function capitalize(text) {

			if(text) {
				text = text.replace(/\b\w/g, function(l){ return l.toUpperCase() });
			}
	
			return text;
		}		
	}];
});
