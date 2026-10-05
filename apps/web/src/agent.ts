export type AgentContext={contextType:'task'|'transport-demand'|'plan'|'bill'|'document'|'page';contextId?:string;suggestedAgent?:string;question?:string};
export function openAgent(context:AgentContext){window.dispatchEvent(new CustomEvent('open-agent',{detail:context}));}
