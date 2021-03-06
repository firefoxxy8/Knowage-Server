angular.module("cockpitModule").controller("dataAssociationController",['$scope','cockpitModule_template','cockpitModule_datasetServices','$mdDialog','sbiModule_translate','$q','sbiModule_messaging','cockpitModule_documentServices','$timeout','sbiModule_restServices',dataAssociationControllerFunction]);

angular.module("cockpitModule").filter('metatype', function() {
	return function(data) {
		var d= data.split(".");
		return d[d.length-1];
	}
})
angular.module("cockpitModule").filter('parametertype', function() {
	return function(data) {
		var d= {STRING:"String",NUM:"Number",DATE:"Date"}
		return d[data];
	}
})

function dataAssociationControllerFunction($scope,cockpitModule_template,cockpitModule_datasetServices,$mdDialog,sbiModule_translate,$q,sbiModule_messaging,cockpitModule_documentServices,$timeout,sbiModule_restServices){
	$scope.displayAssociationsContent=false;
	$timeout(function(){$scope.displayAssociationsContent=true;},0);
	var emptyAss={description:"",fields:[]};
	$scope.utils.currentAss=angular.copy(emptyAss);
	$scope.jsonCurrentAss={};	//this is used to have direct response of data
	$scope.tmpEditCurrAss={};
	
	$scope.toggleAssociation=function(objLabel,fieldName,type){
		var finded=false;
		//check if this association is present
		for(var i=0;i<$scope.utils.currentAss.fields.length;i++){
			if(angular.equals($scope.utils.currentAss.fields[i].store,objLabel) && angular.equals($scope.utils.currentAss.fields[i].type,type)){
				//dataset have one association
				if(angular.equals($scope.utils.currentAss.fields[i].column,fieldName)){
					//remove
					$scope.utils.currentAss.fields.splice(i,1);
					delete $scope.jsonCurrentAss[objLabel];
				}else{
					//change
					$scope.utils.currentAss.fields[i].column=fieldName;
					$scope.jsonCurrentAss[objLabel]=type+fieldName;
				}
				finded=true;
				break;
			}
		}
		
		if(!finded){
			//add it
			$scope.utils.currentAss.fields.push({column:fieldName,store:objLabel,type:type});
			$scope.jsonCurrentAss[objLabel]=type+fieldName;
			
		}
		$scope.refreshAssociationDescriptor($scope.utils.currentAss);
	 }

	 $scope.refreshAssociationDescriptor=function(assoc){
		 var tmpData=[];
		 angular.forEach(assoc.fields,function(item){
			 this.push(item.store+"."+item.column);
		 },tmpData);
		 assoc.description=tmpData.join("=");
	 }

	 $scope.generateAssociationsId=function(){
		 var max=0;
		 angular.forEach($scope.tmpAssociations,function(item){
			 var num=parseInt(item.id.split("#")[1]);
			 if(num>max){
				 max=num
			 }
		 });
		 return "#"+(max+1);
	 }
	 
	 $scope.isValidAssociation=function(){
		 var deferred = $q.defer();
		 var stop=false;
		var copyOfcurrentAss=angular.copy($scope.utils.currentAss);
		delete copyOfcurrentAss.$$hashKey;
		delete copyOfcurrentAss.description;
		delete copyOfcurrentAss.id;
		
		//check for duplicate association
		for(var i=0;i<$scope.tmpAssociations.length;i++){
			var tmpAss= angular.copy($scope.tmpAssociations[i]);
			delete tmpAss.$$hashKey;
			delete tmpAss.description;
			delete tmpAss.id;
			if(angular.equals(tmpAss,copyOfcurrentAss) && !angular.equals($scope.utils.currentAss.id,$scope.tmpAssociations[i].id)){
				deferred.reject(sbiModule_translate.load("sbi.cockpit.association.editor.msg.duplicate"));
				stop=true;
				break;
			}
		}
		
		//check for inconsistent data
		if(!stop){
			var dataType;
			for(var i=0;i<$scope.utils.currentAss.fields.length;i++){
				var ds=cockpitModule_datasetServices.getDatasetByLabel($scope.utils.currentAss.fields[i].store);
				
				if(ds!=undefined){
					//is a dataset
					for(var md=0;md<ds.metadata.fieldsMeta.length;md++){
						if(angular.equals($scope.utils.currentAss.fields[i].column,ds.metadata.fieldsMeta[md].name)){
							if(!angular.equals(ds.metadata.fieldsMeta[md].type,dataType) && dataType!=undefined){
								var confirm = $mdDialog.confirm()
								.title(sbiModule_translate.load("sbi.data.editor.association.AssociationEditor.warning"))
								.textContent(sbiModule_translate.load("sbi.cockpit.association.editor.msg.differentType"))
								.ariaLabel('inconsistence')
								.ok(sbiModule_translate.load("sbi.qbe.messagewin.yes"))
								.cancel(sbiModule_translate.load("sbi.qbe.messagewin.no"));
								
								$mdDialog.show(confirm).then(function() {
									deferred.resolve();
								}, function() {
									deferred.reject();
								});
								stop=true;
								break;
							}else{
								dataType=ds.metadata.fieldsMeta[md].type;
							}
						}
						if(stop){
							break;
						}
					}
				}else{
					var doc=cockpitModule_documentServices.getDocumentByLabel($scope.utils.currentAss.fields[i].store,$scope.tmpAvaiableDocument);
					if(doc!=undefined){
						//is a document
						for(var md=0;md<doc.objParameter.length;md++){
							if(angular.equals($scope.utils.currentAss.fields[i].column,doc.objParameter[md].urlName)){
								if((
										(angular.equals(doc.objParameter[md].type,"STRING") && !angular.equals(dataType,"java.lang.String"))
										|| 
										(angular.equals(doc.objParameter[md].type,"NUM") && angular.equals(dataType,"java.lang.String"))
									) && dataType!=undefined){
									var confirm = $mdDialog.confirm()
									.title(sbiModule_translate.load("sbi.data.editor.association.AssociationEditor.warning"))
									.textContent(sbiModule_translate.load("sbi.cockpit.association.editor.msg.differentType"))
									.ariaLabel('inconsistence')
									.ok(sbiModule_translate.load("sbi.qbe.messagewin.yes"))
									.cancel(sbiModule_translate.load("sbi.qbe.messagewin.no"));
									
									$mdDialog.show(confirm).then(function() {
										deferred.resolve();
									}, function() {
										deferred.reject();
									});
									stop=true;
									break;
								}else{
									if(angular.equals(doc.objParameter[md].type,"STRING")){
										dataType="java.lang.String";
									}
								}
							}
							if(stop){
								break;
							}
						}
					}else{
						sbiModule_messaging.showErrorMessage($scope.utils.currentAss.fields[i].store+ " Not Found","")
					}
				}
				
				
			}
		}
		 
		if(!stop){
			deferred.resolve();
		}
		
		 return deferred.promise;
	 }
	 
	 $scope.saveCurrentAssociations=function(){
		 $scope.isValidAssociation().then(
				 function(){
					 if($scope.utils.currentAss.id==undefined){
						 $scope.utils.currentAss.id=$scope.generateAssociationsId();
					 }
					 $scope.tmpAssociations.unshift( $scope.utils.currentAss);
					 $scope.tmpEditCurrAss={};
					 $scope.deleteCurrentAssociations();
				 },
				 function(message){
					 if(message!=undefined){
						 sbiModule_messaging.showErrorMessage(message,"")
					 }
				 });
		 
	 }
	 
	$scope.deleteCurrentAssociations=function(){
		if(Object.keys($scope.tmpEditCurrAss).length>0){
			//modify of present ass
			$scope.tmpAssociations.unshift( $scope.tmpEditCurrAss);
		} 
		$scope.tmpEditCurrAss={};
		$scope.utils.currentAss=angular.copy(emptyAss);
		$scope.jsonCurrentAss={};	 
	}
	 
	 $scope.deleteAssociations=function(ass){
		 
			var confirm = $mdDialog.confirm()
	        .title(sbiModule_translate.load("sbi.cockpit.associations.delete.title"))
	        .textContent(sbiModule_translate.load("sbi.cockpit.associations.delete.content"))
	        .ariaLabel('delete associations')
	        .ok(sbiModule_translate.load("sbi.ds.wizard.confirm"))
	        .cancel(sbiModule_translate.load("sbi.ds.wizard.cancel"));
		 
			$mdDialog.show(confirm).then(function() {
				 $scope.tmpAssociations.splice( $scope.tmpAssociations.indexOf(ass),1);
				 $scope.tmpEditCurrAss={};
				 $scope.deleteCurrentAssociations();
		  });
	 }
	 
	 $scope.editAssociations=function(ass){
		 angular.copy(ass,$scope.tmpEditCurrAss);
		 $scope.tmpAssociations.splice( $scope.tmpAssociations.indexOf(ass),1);
		 angular.copy(ass,$scope.utils.currentAss);
		 $scope.jsonCurrentAss={};
		 angular.forEach(ass.fields,function(item){
			 this[item.store]=item.type+item.column;
		 },$scope.jsonCurrentAss);
	 }
	 
	 $scope.clearAssociations=function(){
		 var confirm = $mdDialog.confirm()
	        .title(sbiModule_translate.load("sbi.cockpit.associations.delete.title"))
	        .textContent(sbiModule_translate.load("sbi.cockpit.associations.delete.content"))
	        .ariaLabel('delete associations')
	        .ok(sbiModule_translate.load("sbi.ds.wizard.confirm"))
	        .cancel(sbiModule_translate.load("sbi.ds.wizard.cancel"));
		 
			$mdDialog.show(confirm).then(function() {
				 angular.copy([],$scope.tmpAssociations);
				 $scope.tmpEditCurrAss={};
				 $scope.deleteCurrentAssociations();
		  });
	 }
	 
	 $scope.autodetect=function(){
		cockpitModule_datasetServices.autodetect("cockpitDataConfig",$scope.tmpAvaiableDataset,$scope.tmpAssociations)
		.then(function(autodetectResult){
			var association = $scope.getAssociationFromAutodetectRow(autodetectResult);
			$scope.tmpAssociations.unshift(association);				
		});
	 }
	 
	 $scope.getAssociationFromAutodetectRow=function(autodetectRow){
		var association = {};
		
		association["id"] = $scope.generateAssociationsId();
		
		var associationFields = [];
		for (var property in autodetectRow) {
		    if (autodetectRow.hasOwnProperty(property) && autodetectRow[property] && property!="___similarity" && property!="___length" && property!="___id") {
		    	var field = {};
				field["column"] = autodetectRow[property];
				field["store"] = property;
				field["type"] = "dataset";
		    	associationFields.push(field);
		    }
		}
		association["fields"] = associationFields;
		
		var description = "";
		for(var i=0; i<associationFields.length; i++){
			var associationField = associationFields[i];
			description += (associationField.store + "." + associationField.column + "=");
		}
		description = description.slice(0, -1);
		association["description"] = description;
		
		return association;
	}
}