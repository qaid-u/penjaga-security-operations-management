import { Component, useEffect, useLayoutEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useBuildingAsset } from './building/useBuildingAsset';
import { getBuilding } from './building/buildingModels';
import { overviewPose } from './building/modelGeometry';

const building=getBuilding('DJM');
class SceneBoundary extends Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?null:this.props.children;}
}
function Exterior({data,onLost}) {
  const {camera,size,invalidate,gl}=useThree();
  useLayoutEffect(()=>{
    const pose=overviewPose(data.bounds,size.width/size.height,[.75,.55,1]);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateProjectionMatrix();invalidate();
  },[camera,data,size,invalidate]);
  useEffect(()=>{
    const lost=event=>{event.preventDefault();onLost();};
    gl.domElement.addEventListener('webglcontextlost',lost);
    return ()=>gl.domElement.removeEventListener('webglcontextlost',lost);
  },[gl,onLost]);
  return <primitive object={data.scene} dispose={null}/>;
}
export default function LoginBuilding() {
  const {data,error}=useBuildingAsset(building.modelUrl,building);
  const [lost,setLost]=useState(false);
  if(!data||error||lost)return null;
  return <SceneBoundary><Canvas frameloop="demand" dpr={[1,1.35]} camera={{fov:38,near:.1,far:5000}} gl={{alpha:true,antialias:true,powerPreference:'low-power'}} fallback={null}>
    <ambientLight intensity={1.35}/><hemisphereLight args={['#d8e8ff','#636653',1.7]}/><directionalLight position={[80,150,100]} intensity={2.5}/>
    <Exterior data={data} onLost={()=>setLost(true)}/>
  </Canvas></SceneBoundary>;
}
