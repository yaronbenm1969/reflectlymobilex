import { getCubeTemplate } from './templates/cubeTemplate';
import { getFlipPagesTemplate } from './templates/flipPagesTemplate';

export const ANIMATION_FORMATS = {
  'cube-3d': {
    id: 'cube-3d',
    name: 'קוביה תלת מימד',
    getTemplate: getCubeTemplate,
  },
  'flip-pages': {
    id: 'flip-pages', 
    name: 'דפים מתהפכים',
    getTemplate: getFlipPagesTemplate,
  },
};

export const getAnimationTemplate = (formatId, faces, cubeSize) => {
  const format = ANIMATION_FORMATS[formatId] || ANIMATION_FORMATS['cube-3d'];
  return format.getTemplate(faces, cubeSize);
};

export const getSupportedFormats = () => Object.keys(ANIMATION_FORMATS);
