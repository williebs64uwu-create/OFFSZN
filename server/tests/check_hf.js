import { HfInference } from '@huggingface/inference';

const hf = new HfInference('dummy');
console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(hf)));
console.log('Instance properties:', Object.keys(hf));
