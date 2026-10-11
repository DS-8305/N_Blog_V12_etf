export const commands=['help','job:init','source:inspect','collect:run','collect:check','render:run','render:cards','post:compile','draft:check','draft:run','draft:resume'] as const;
const allowed:Record<string,string[]>={
 'job:init':['symbol','market','as-of','issuer','isin','workspace-root','min-length','max-length'],
 'source:inspect':['job'],'collect:run':['job','cdp','profile'],'collect:check':['job'],
 'render:run':['job','cdp','profile'],'render:cards':['job'],'post:compile':['job'],'draft:check':['job'],
 'draft:run':['job','cdp','profile'],'draft:resume':['job','cdp','profile'],help:[]
};
export function parseArguments(argv:string[]):{command:typeof commands[number];flags:Record<string,string>}{
 const command=argv[0]??'help';if(!commands.includes(command as any))throw Error('unknown_command');
 const flags:Record<string,string>={};
 for(let i=1;i<argv.length;i+=2){const name=argv[i];if(!name?.startsWith('--')||!argv[i+1]||argv[i+1]!.startsWith('--')||!allowed[command]?.includes(name.slice(2))||Object.hasOwn(flags,name.slice(2)))throw Error('invalid_arguments');flags[name.slice(2)]=argv[i+1]!;}
 return {command:command as typeof commands[number],flags};
}
export function required(flags:Record<string,string>,name:string):string{const value=flags[name];if(!value)throw Error('missing_argument:'+name);return value;}
