// Element Plus initializes aria-disabled once; keep it aligned when an operation ends.
function syncNumber(element:HTMLElement){queueMicrotask(()=>{
 const input=element.querySelector<HTMLInputElement>('input[type="number"]');
 if(input)input.setAttribute('aria-disabled',String(input.disabled));
});}
export const numberA11y={mounted:syncNumber,updated:syncNumber};
