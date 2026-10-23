import { useEffect, useRef, useSyncExternalStore } from 'react';
import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Box3, Vector3 } from 'three';
import { focusPose, overviewPose } from './modelGeometry';

const motionQuery = () => window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (callback) => { const query = motionQuery(); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback); };

export function CameraController({ data, selected, command }) {
  const controls = useRef();
  const initialized = useRef(false);
  const { size } = useThree();
  const reduceMotion = useSyncExternalStore(subscribe, () => motionQuery().matches, () => false);
  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    const radius = data.size.length();
    instance.minDistance = radius * .13;
    instance.maxDistance = radius * 5;
    instance.setBoundary(new Box3(data.bounds.min.clone().sub(new Vector3(radius, 0, radius)), data.bounds.max.clone().add(new Vector3(radius, radius * 3, radius))));
    const hotspot = data.hotspots.find((item) => item.id === selected && item.position);
    const pose = hotspot ? focusPose(hotspot.position, data.bounds) : overviewPose(data.bounds, size.width / size.height);
    instance.setLookAt(...pose.position.toArray(), ...pose.target.toArray(), initialized.current && !reduceMotion);
    initialized.current = true;
  }, [data, selected, size.width, size.height, reduceMotion, command.reset]);
  useEffect(() => {
    if (command.zoom) controls.current?.dolly(command.zoom.direction * data.size.length() * .09, !reduceMotion);
  }, [command.zoom, data, reduceMotion]);
  return <CameraControls ref={controls} makeDefault smoothTime={reduceMotion ? 0 : .45} draggingSmoothTime={reduceMotion ? 0 : .15} minPolarAngle={.15} maxPolarAngle={Math.PI / 2 - .08} />;
}
