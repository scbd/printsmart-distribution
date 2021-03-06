define(['lodash', 'app'], function(_) {
	return ["$scope", "$cookies", "$http", "$route", function ($scope, $cookies, $http, $route) {

		var location = $route.current.params.location || '';

		$scope.printShopEnabled = !!$cookies.get("machineAuthorization");

        if(!$scope.printShopEnabled)
            return;

        var printShop = JSON.parse(localStorage.printShop||"{}");

        localStorage.removeItem("printShop");

		$scope.badgeCode = printShop.badge || "";
		$scope.documents = printShop.documents||[ { url : "", copies : 0 }];

		_.each($scope.documents, function(d) { d.copies = 0; });

		//============================================================
		//
		//
		//============================================================
		$scope.$watch('allCopies', function(){

			$scope.allCopies = Math.max($scope.allCopies, 0);

			_.each($scope.documents, function(d) {

				if(!d.printed)
					d.copies = $scope.allCopies;
			});
		});

		//============================================================
		//
		//
		//============================================================
		$scope.add = function(){

			$scope.documents.push({ url : "", copies : $scope.allCopies });
		};

		//============================================================
		//
		//
		//============================================================
		$scope.isReady = function(d){
			return d.url && d.copies && d.copies>0;
		};

		//============================================================
		//
		//
		//============================================================
		$scope.readyDocuments = function(){

			return _.filter($scope.documents, $scope.isReady);
		};

		//============================================================
		//
		//
		//============================================================
		$scope.printAll = function(){

            delete $scope.error;

			// Prepare data

			var badge = $scope.cleanBadge();
			var documents = $scope.readyDocuments();

			if(!documents.length) {
				alert("Nothing to print!");
				return;
			}

			$scope.loading = true;

			return $http.get("/api/v2014/kronos/badges/"+badge).then(function(res){

				var canPrintShop = ((res.data||{}).BadgeConfigInfo||{}).CanPrintShop || false;

				if(!canPrintShop)
					throw  { status: 403 };

			}).then(function(){

				var postData = {
					badge : badge,
					location: location
				};

				postData.documents = _(documents).map(function(d) {
					return _.extend({ symbol : d.url, tag : "", language : "en" }, d, { anonymous:true });
				});

				return $http.post("/api/v2014/printsmart-requests/batch", postData);

			}).then(function(){

				$scope.loading = false;

				_.each(documents, function(d){
					d.printed = true;
                    d.copies = 0;
				});

			}).catch(function(res){

				$scope.loading = false;

				     if(res.status==400) $scope.error = res.data || { error: "BAD_REQUEST" };
				else if(res.status==403) $scope.error = res.data || { error: "NOT_AUTHORIZED" };
				else if(res.status==404) $scope.error = res.data || { error: "NO_SERVICE" };
				else if(res.status==500) $scope.error = { error: "NO_SERVICE" };
				else                     $scope.error = { error: "UNKNOWN",    data : res.data };
			});
		};

		//==============================================
		//
		//
		//==============================================
		$scope.cleanBadge = function() {
			return ($scope.badgeCode||"").replace(/[^0-9]/g, "");
		};
	}];
});
