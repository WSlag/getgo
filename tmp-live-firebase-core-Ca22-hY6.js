const Ar=()=>{};var ni={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yi=function(n){const i=[];let s=0;for(let l=0;l<n.length;l++){let g=n.charCodeAt(l);g<128?i[s++]=g:g<2048?(i[s++]=g>>6|192,i[s++]=g&63|128):(g&64512)===55296&&l+1<n.length&&(n.charCodeAt(l+1)&64512)===56320?(g=65536+((g&1023)<<10)+(n.charCodeAt(++l)&1023),i[s++]=g>>18|240,i[s++]=g>>12&63|128,i[s++]=g>>6&63|128,i[s++]=g&63|128):(i[s++]=g>>12|224,i[s++]=g>>6&63|128,i[s++]=g&63|128)}return i},Tr=function(n){const i=[];let s=0,l=0;for(;s<n.length;){const g=n[s++];if(g<128)i[l++]=String.fromCharCode(g);else if(g>191&&g<224){const w=n[s++];i[l++]=String.fromCharCode((g&31)<<6|w&63)}else if(g>239&&g<365){const w=n[s++],v=n[s++],S=n[s++],C=((g&7)<<18|(w&63)<<12|(v&63)<<6|S&63)-65536;i[l++]=String.fromCharCode(55296+(C>>10)),i[l++]=String.fromCharCode(56320+(C&1023))}else{const w=n[s++],v=n[s++];i[l++]=String.fromCharCode((g&15)<<12|(w&63)<<6|v&63)}}return i.join("")},vi={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,i){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const s=i?this.byteToCharMapWebSafe_:this.byteToCharMap_,l=[];for(let g=0;g<n.length;g+=3){const w=n[g],v=g+1<n.length,S=v?n[g+1]:0,C=g+2<n.length,E=C?n[g+2]:0,F=w>>2,T=(w&3)<<4|S>>4;let I=(S&15)<<2|E>>6,k=E&63;C||(k=64,v||(I=64)),l.push(s[F],s[T],s[I],s[k])}return l.join("")},encodeString(n,i){return this.HAS_NATIVE_SUPPORT&&!i?btoa(n):this.encodeByteArray(yi(n),i)},decodeString(n,i){return this.HAS_NATIVE_SUPPORT&&!i?atob(n):Tr(this.decodeStringToByteArray(n,i))},decodeStringToByteArray(n,i){this.init_();const s=i?this.charToByteMapWebSafe_:this.charToByteMap_,l=[];for(let g=0;g<n.length;){const w=s[n.charAt(g++)],S=g<n.length?s[n.charAt(g)]:0;++g;const E=g<n.length?s[n.charAt(g)]:64;++g;const T=g<n.length?s[n.charAt(g)]:64;if(++g,w==null||S==null||E==null||T==null)throw new _r;const I=w<<2|S>>4;if(l.push(I),E!==64){const k=S<<4&240|E>>2;if(l.push(k),T!==64){const B=E<<6&192|T;l.push(B)}}}return l},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class _r extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Dr=function(n){const i=yi(n);return vi.encodeByteArray(i,!0)},re=function(n){return Dr(n).replace(/\./g,"")},Fe=function(n){try{return vi.decodeString(n,!0)}catch(i){console.error("base64Decode failed: ",i)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Or(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rr=()=>Or().__FIREBASE_DEFAULTS__,Mr=()=>{if(typeof process>"u"||typeof ni>"u")return;const n=ni.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Br=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const i=n&&Fe(n[1]);return i&&JSON.parse(i)},oe=()=>{try{return Ar()||Rr()||Mr()||Br()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Pr=n=>{var i,s;return(s=(i=oe())==null?void 0:i.emulatorHosts)==null?void 0:s[n]},ra=n=>{const i=Pr(n);if(!i)return;const s=i.lastIndexOf(":");if(s<=0||s+1===i.length)throw new Error(`Invalid host ${i} with no separate hostname and port!`);const l=parseInt(i.substring(s+1),10);return i[0]==="["?[i.substring(1,s-1),l]:[i.substring(0,s),l]},wi=()=>{var n;return(n=oe())==null?void 0:n.config},sa=n=>{var i;return(i=oe())==null?void 0:i[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kr{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((i,s)=>{this.resolve=i,this.reject=s})}wrapCallback(i){return(s,l)=>{s?this.reject(s):this.resolve(l),typeof i=="function"&&(this.promise.catch(()=>{}),i.length===1?i(s):i(s,l))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xr(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function oa(n){return(await fetch(n,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function aa(n,i){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const s={alg:"none",type:"JWT"},l=i||"demo-project",g=n.iat||0,w=n.sub||n.user_id;if(!w)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const v={iss:`https://securetoken.google.com/${l}`,aud:l,iat:g,exp:g+3600,auth_time:g,sub:w,user_id:w,firebase:{sign_in_provider:"custom",identities:{}},...n};return[re(JSON.stringify(s)),re(JSON.stringify(v)),""].join(".")}const Lt={};function jr(){const n={prod:[],emulator:[]};for(const i of Object.keys(Lt))Lt[i]?n.emulator.push(i):n.prod.push(i);return n}function Nr(n){let i=document.getElementById(n),s=!1;return i||(i=document.createElement("div"),i.setAttribute("id",n),s=!0),{created:s,element:i}}let ii=!1;function ha(n,i){if(typeof window>"u"||typeof document>"u"||!xr(window.location.host)||Lt[n]===i||Lt[n]||ii)return;Lt[n]=i;function s(I){return`__firebase__banner__${I}`}const l="__firebase__banner",w=jr().prod.length>0;function v(){const I=document.getElementById(l);I&&I.remove()}function S(I){I.style.display="flex",I.style.background="#7faaf0",I.style.position="fixed",I.style.bottom="5px",I.style.left="5px",I.style.padding=".5em",I.style.borderRadius="5px",I.style.alignItems="center"}function C(I,k){I.setAttribute("width","24"),I.setAttribute("id",k),I.setAttribute("height","24"),I.setAttribute("viewBox","0 0 24 24"),I.setAttribute("fill","none"),I.style.marginLeft="-6px"}function E(){const I=document.createElement("span");return I.style.cursor="pointer",I.style.marginLeft="16px",I.style.fontSize="24px",I.innerHTML=" &times;",I.onclick=()=>{ii=!0,v()},I}function F(I,k){I.setAttribute("id",k),I.innerText="Learn more",I.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",I.setAttribute("target","__blank"),I.style.paddingLeft="5px",I.style.textDecoration="underline"}function T(){const I=Nr(l),k=s("text"),B=document.getElementById(k)||document.createElement("span"),j=s("learnmore"),R=document.getElementById(j)||document.createElement("a"),G=s("preprendIcon"),W=document.getElementById(G)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(I.created){const V=I.element;S(V),F(R,j);const Y=E();C(W,G),V.append(W,B,R,Y),document.body.appendChild(V)}w?(B.innerText="Preview backend disconnected.",W.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(W.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,B.innerText="Preview backend running in this workspace."),B.setAttribute("id",k)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",T):T()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bi(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function la(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(bi())}function Ei(){var i;const n=(i=oe())==null?void 0:i.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function ca(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function ua(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function fa(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function pa(){const n=bi();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function ga(){return!Ei()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function da(){return!Ei()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function Lr(){try{return typeof indexedDB=="object"}catch{return!1}}function Hr(){return new Promise((n,i)=>{try{let s=!0;const l="validate-browser-context-for-indexeddb-analytics-module",g=self.indexedDB.open(l);g.onsuccess=()=>{g.result.close(),s||self.indexedDB.deleteDatabase(l),n(!0)},g.onupgradeneeded=()=>{s=!1},g.onerror=()=>{var w;i(((w=g.error)==null?void 0:w.message)||"")}}catch(s){i(s)}})}function ma(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fr="FirebaseError";class Et extends Error{constructor(i,s,l){super(s),this.code=i,this.customData=l,this.name=Fr,Object.setPrototypeOf(this,Et.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Ge.prototype.create)}}class Ge{constructor(i,s,l){this.service=i,this.serviceName=s,this.errors=l}create(i,...s){const l=s[0]||{},g=`${this.service}/${i}`,w=this.errors[i],v=w?$r(w,l):"Error",S=`${this.serviceName}: ${v} (${g}).`;return new Et(g,S,l)}}function $r(n,i){return n.replace(Ur,(s,l)=>{const g=i[l];return g!=null?String(g):`<${l}?>`})}const Ur=/\{\$([^}]+)}/g;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ri(n){return JSON.parse(n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vr=function(n){let i={},s={},l={},g="";try{const w=n.split(".");i=ri(Fe(w[0])||""),s=ri(Fe(w[1])||""),g=w[2],l=s.d||{},delete s.d}catch{}return{header:i,claims:s,data:l,signature:g}},ya=function(n){const i=Vr(n).claims;return typeof i=="object"&&i.hasOwnProperty("iat")?i.iat:null};function va(n){for(const i in n)if(Object.prototype.hasOwnProperty.call(n,i))return!1;return!0}function $e(n,i){if(n===i)return!0;const s=Object.keys(n),l=Object.keys(i);for(const g of s){if(!l.includes(g))return!1;const w=n[g],v=i[g];if(si(w)&&si(v)){if(!$e(w,v))return!1}else if(w!==v)return!1}for(const g of l)if(!s.includes(g))return!1;return!0}function si(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wa(n){const i=[];for(const[s,l]of Object.entries(n))Array.isArray(l)?l.forEach(g=>{i.push(encodeURIComponent(s)+"="+encodeURIComponent(g))}):i.push(encodeURIComponent(s)+"="+encodeURIComponent(l));return i.length?"&"+i.join("&"):""}function ba(n){const i={};return n.replace(/^\?/,"").split("&").forEach(l=>{if(l){const[g,w]=l.split("=");i[decodeURIComponent(g)]=decodeURIComponent(w)}}),i}function Ea(n){const i=n.indexOf("?");if(!i)return"";const s=n.indexOf("#",i);return n.substring(i,s>0?s:void 0)}function Ia(n,i){const s=new zr(n,i);return s.subscribe.bind(s)}class zr{constructor(i,s){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=s,this.task.then(()=>{i(this)}).catch(l=>{this.error(l)})}next(i){this.forEachObserver(s=>{s.next(i)})}error(i){this.forEachObserver(s=>{s.error(i)}),this.close(i)}complete(){this.forEachObserver(i=>{i.complete()}),this.close()}subscribe(i,s,l){let g;if(i===void 0&&s===void 0&&l===void 0)throw new Error("Missing Observer.");Wr(i,["next","error","complete"])?g=i:g={next:i,error:s,complete:l},g.next===void 0&&(g.next=Pe),g.error===void 0&&(g.error=Pe),g.complete===void 0&&(g.complete=Pe);const w=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?g.error(this.finalError):g.complete()}catch{}}),this.observers.push(g),w}unsubscribeOne(i){this.observers===void 0||this.observers[i]===void 0||(delete this.observers[i],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(i){if(!this.finalized)for(let s=0;s<this.observers.length;s++)this.sendOne(s,i)}sendOne(i,s){this.task.then(()=>{if(this.observers!==void 0&&this.observers[i]!==void 0)try{s(this.observers[i])}catch(l){typeof console<"u"&&console.error&&console.error(l)}})}close(i){this.finalized||(this.finalized=!0,i!==void 0&&(this.finalError=i),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function Wr(n,i){if(typeof n!="object"||n===null)return!1;for(const s of i)if(s in n&&typeof n[s]=="function")return!0;return!1}function Pe(){}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xr=1e3,qr=2,Gr=14400*1e3,Kr=.5;function Sa(n,i=Xr,s=qr){const l=i*Math.pow(s,n),g=Math.round(Kr*l*(Math.random()-.5)*2);return Math.min(Gr,l+g)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ca(n){return n&&n._delegate?n._delegate:n}class bt{constructor(i,s,l){this.name=i,this.instanceFactory=s,this.type=l,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(i){return this.instantiationMode=i,this}setMultipleInstances(i){return this.multipleInstances=i,this}setServiceProps(i){return this.serviceProps=i,this}setInstanceCreatedCallback(i){return this.onInstanceCreated=i,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ft="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jr{constructor(i,s){this.name=i,this.container=s,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(i){const s=this.normalizeInstanceIdentifier(i);if(!this.instancesDeferred.has(s)){const l=new kr;if(this.instancesDeferred.set(s,l),this.isInitialized(s)||this.shouldAutoInitialize())try{const g=this.getOrInitializeService({instanceIdentifier:s});g&&l.resolve(g)}catch{}}return this.instancesDeferred.get(s).promise}getImmediate(i){const s=this.normalizeInstanceIdentifier(i==null?void 0:i.identifier),l=(i==null?void 0:i.optional)??!1;if(this.isInitialized(s)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:s})}catch(g){if(l)return null;throw g}else{if(l)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(i){if(i.name!==this.name)throw Error(`Mismatching Component ${i.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=i,!!this.shouldAutoInitialize()){if(Zr(i))try{this.getOrInitializeService({instanceIdentifier:ft})}catch{}for(const[s,l]of this.instancesDeferred.entries()){const g=this.normalizeInstanceIdentifier(s);try{const w=this.getOrInitializeService({instanceIdentifier:g});l.resolve(w)}catch{}}}}clearInstance(i=ft){this.instancesDeferred.delete(i),this.instancesOptions.delete(i),this.instances.delete(i)}async delete(){const i=Array.from(this.instances.values());await Promise.all([...i.filter(s=>"INTERNAL"in s).map(s=>s.INTERNAL.delete()),...i.filter(s=>"_delete"in s).map(s=>s._delete())])}isComponentSet(){return this.component!=null}isInitialized(i=ft){return this.instances.has(i)}getOptions(i=ft){return this.instancesOptions.get(i)||{}}initialize(i={}){const{options:s={}}=i,l=this.normalizeInstanceIdentifier(i.instanceIdentifier);if(this.isInitialized(l))throw Error(`${this.name}(${l}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const g=this.getOrInitializeService({instanceIdentifier:l,options:s});for(const[w,v]of this.instancesDeferred.entries()){const S=this.normalizeInstanceIdentifier(w);l===S&&v.resolve(g)}return g}onInit(i,s){const l=this.normalizeInstanceIdentifier(s),g=this.onInitCallbacks.get(l)??new Set;g.add(i),this.onInitCallbacks.set(l,g);const w=this.instances.get(l);return w&&i(w,l),()=>{g.delete(i)}}invokeOnInitCallbacks(i,s){const l=this.onInitCallbacks.get(s);if(l)for(const g of l)try{g(i,s)}catch{}}getOrInitializeService({instanceIdentifier:i,options:s={}}){let l=this.instances.get(i);if(!l&&this.component&&(l=this.component.instanceFactory(this.container,{instanceIdentifier:Yr(i),options:s}),this.instances.set(i,l),this.instancesOptions.set(i,s),this.invokeOnInitCallbacks(l,i),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,i,l)}catch{}return l||null}normalizeInstanceIdentifier(i=ft){return this.component?this.component.multipleInstances?i:ft:i}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Yr(n){return n===ft?void 0:n}function Zr(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qr{constructor(i){this.name=i,this.providers=new Map}addComponent(i){const s=this.getProvider(i.name);if(s.isComponentSet())throw new Error(`Component ${i.name} has already been registered with ${this.name}`);s.setComponent(i)}addOrOverwriteComponent(i){this.getProvider(i.name).isComponentSet()&&this.providers.delete(i.name),this.addComponent(i)}getProvider(i){if(this.providers.has(i))return this.providers.get(i);const s=new Jr(i,this);return this.providers.set(i,s),s}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ii=[];var O;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(O||(O={}));const ts={debug:O.DEBUG,verbose:O.VERBOSE,info:O.INFO,warn:O.WARN,error:O.ERROR,silent:O.SILENT},es=O.INFO,ns={[O.DEBUG]:"log",[O.VERBOSE]:"log",[O.INFO]:"info",[O.WARN]:"warn",[O.ERROR]:"error"},is=(n,i,...s)=>{if(i<n.logLevel)return;const l=new Date().toISOString(),g=ns[i];if(g)console[g](`[${l}]  ${n.name}:`,...s);else throw new Error(`Attempted to log a message with an invalid logType (value: ${i})`)};class rs{constructor(i){this.name=i,this._logLevel=es,this._logHandler=is,this._userLogHandler=null,Ii.push(this)}get logLevel(){return this._logLevel}set logLevel(i){if(!(i in O))throw new TypeError(`Invalid value "${i}" assigned to \`logLevel\``);this._logLevel=i}setLogLevel(i){this._logLevel=typeof i=="string"?ts[i]:i}get logHandler(){return this._logHandler}set logHandler(i){if(typeof i!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=i}get userLogHandler(){return this._userLogHandler}set userLogHandler(i){this._userLogHandler=i}debug(...i){this._userLogHandler&&this._userLogHandler(this,O.DEBUG,...i),this._logHandler(this,O.DEBUG,...i)}log(...i){this._userLogHandler&&this._userLogHandler(this,O.VERBOSE,...i),this._logHandler(this,O.VERBOSE,...i)}info(...i){this._userLogHandler&&this._userLogHandler(this,O.INFO,...i),this._logHandler(this,O.INFO,...i)}warn(...i){this._userLogHandler&&this._userLogHandler(this,O.WARN,...i),this._logHandler(this,O.WARN,...i)}error(...i){this._userLogHandler&&this._userLogHandler(this,O.ERROR,...i),this._logHandler(this,O.ERROR,...i)}}function ss(n){Ii.forEach(i=>{i.setLogLevel(n)})}const os=(n,i)=>i.some(s=>n instanceof s);let oi,ai;function as(){return oi||(oi=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function hs(){return ai||(ai=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const Si=new WeakMap,Ue=new WeakMap,Ci=new WeakMap,ke=new WeakMap,Ke=new WeakMap;function ls(n){const i=new Promise((s,l)=>{const g=()=>{n.removeEventListener("success",w),n.removeEventListener("error",v)},w=()=>{s(K(n.result)),g()},v=()=>{l(n.error),g()};n.addEventListener("success",w),n.addEventListener("error",v)});return i.then(s=>{s instanceof IDBCursor&&Si.set(s,n)}).catch(()=>{}),Ke.set(i,n),i}function cs(n){if(Ue.has(n))return;const i=new Promise((s,l)=>{const g=()=>{n.removeEventListener("complete",w),n.removeEventListener("error",v),n.removeEventListener("abort",v)},w=()=>{s(),g()},v=()=>{l(n.error||new DOMException("AbortError","AbortError")),g()};n.addEventListener("complete",w),n.addEventListener("error",v),n.addEventListener("abort",v)});Ue.set(n,i)}let Ve={get(n,i,s){if(n instanceof IDBTransaction){if(i==="done")return Ue.get(n);if(i==="objectStoreNames")return n.objectStoreNames||Ci.get(n);if(i==="store")return s.objectStoreNames[1]?void 0:s.objectStore(s.objectStoreNames[0])}return K(n[i])},set(n,i,s){return n[i]=s,!0},has(n,i){return n instanceof IDBTransaction&&(i==="done"||i==="store")?!0:i in n}};function us(n){Ve=n(Ve)}function fs(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(i,...s){const l=n.call(xe(this),i,...s);return Ci.set(l,i.sort?i.sort():[i]),K(l)}:hs().includes(n)?function(...i){return n.apply(xe(this),i),K(Si.get(this))}:function(...i){return K(n.apply(xe(this),i))}}function ps(n){return typeof n=="function"?fs(n):(n instanceof IDBTransaction&&cs(n),os(n,as())?new Proxy(n,Ve):n)}function K(n){if(n instanceof IDBRequest)return ls(n);if(ke.has(n))return ke.get(n);const i=ps(n);return i!==n&&(ke.set(n,i),Ke.set(i,n)),i}const xe=n=>Ke.get(n);function Ai(n,i,{blocked:s,upgrade:l,blocking:g,terminated:w}={}){const v=indexedDB.open(n,i),S=K(v);return l&&v.addEventListener("upgradeneeded",C=>{l(K(v.result),C.oldVersion,C.newVersion,K(v.transaction),C)}),s&&v.addEventListener("blocked",C=>s(C.oldVersion,C.newVersion,C)),S.then(C=>{w&&C.addEventListener("close",()=>w()),g&&C.addEventListener("versionchange",E=>g(E.oldVersion,E.newVersion,E))}).catch(()=>{}),S}function Aa(n,{blocked:i}={}){const s=indexedDB.deleteDatabase(n);return i&&s.addEventListener("blocked",l=>i(l.oldVersion,l)),K(s).then(()=>{})}const gs=["get","getKey","getAll","getAllKeys","count"],ds=["put","add","delete","clear"],je=new Map;function hi(n,i){if(!(n instanceof IDBDatabase&&!(i in n)&&typeof i=="string"))return;if(je.get(i))return je.get(i);const s=i.replace(/FromIndex$/,""),l=i!==s,g=ds.includes(s);if(!(s in(l?IDBIndex:IDBObjectStore).prototype)||!(g||gs.includes(s)))return;const w=async function(v,...S){const C=this.transaction(v,g?"readwrite":"readonly");let E=C.store;return l&&(E=E.index(S.shift())),(await Promise.all([E[s](...S),g&&C.done]))[0]};return je.set(i,w),w}us(n=>({...n,get:(i,s,l)=>hi(i,s)||n.get(i,s,l),has:(i,s)=>!!hi(i,s)||n.has(i,s)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ms{constructor(i){this.container=i}getPlatformInfoString(){return this.container.getProviders().map(s=>{if(ys(s)){const l=s.getImmediate();return`${l.library}/${l.version}`}else return null}).filter(s=>s).join(" ")}}function ys(n){const i=n.getComponent();return(i==null?void 0:i.type)==="VERSION"}const ze="@firebase/app",li="0.14.7";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const J=new rs("@firebase/app"),vs="@firebase/app-compat",ws="@firebase/analytics-compat",bs="@firebase/analytics",Es="@firebase/app-check-compat",Is="@firebase/app-check",Ss="@firebase/auth",Cs="@firebase/auth-compat",As="@firebase/database",Ts="@firebase/data-connect",_s="@firebase/database-compat",Ds="@firebase/functions",Os="@firebase/functions-compat",Rs="@firebase/installations",Ms="@firebase/installations-compat",Bs="@firebase/messaging",Ps="@firebase/messaging-compat",ks="@firebase/performance",xs="@firebase/performance-compat",js="@firebase/remote-config",Ns="@firebase/remote-config-compat",Ls="@firebase/storage",Hs="@firebase/storage-compat",Fs="@firebase/firestore",$s="@firebase/ai",Us="@firebase/firestore-compat",Vs="firebase",zs="12.8.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const We="[DEFAULT]",Ws={[ze]:"fire-core",[vs]:"fire-core-compat",[bs]:"fire-analytics",[ws]:"fire-analytics-compat",[Is]:"fire-app-check",[Es]:"fire-app-check-compat",[Ss]:"fire-auth",[Cs]:"fire-auth-compat",[As]:"fire-rtdb",[Ts]:"fire-data-connect",[_s]:"fire-rtdb-compat",[Ds]:"fire-fn",[Os]:"fire-fn-compat",[Rs]:"fire-iid",[Ms]:"fire-iid-compat",[Bs]:"fire-fcm",[Ps]:"fire-fcm-compat",[ks]:"fire-perf",[xs]:"fire-perf-compat",[js]:"fire-rc",[Ns]:"fire-rc-compat",[Ls]:"fire-gcs",[Hs]:"fire-gcs-compat",[Fs]:"fire-fst",[Us]:"fire-fst-compat",[$s]:"fire-vertex","fire-js":"fire-js",[Vs]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ht=new Map,Xs=new Map,Xe=new Map;function ci(n,i){try{n.container.addComponent(i)}catch(s){J.debug(`Component ${i.name} failed to register with FirebaseApp ${n.name}`,s)}}function Ft(n){const i=n.name;if(Xe.has(i))return J.debug(`There were multiple attempts to register component ${i}.`),!1;Xe.set(i,n);for(const s of Ht.values())ci(s,n);for(const s of Xs.values())ci(s,n);return!0}function Ti(n,i){const s=n.container.getProvider("heartbeat").getImmediate({optional:!0});return s&&s.triggerHeartbeat(),n.container.getProvider(i)}function Ta(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qs={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},st=new Ge("app","Firebase",qs);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gs{constructor(i,s,l){this._isDeleted=!1,this._options={...i},this._config={...s},this._name=s.name,this._automaticDataCollectionEnabled=s.automaticDataCollectionEnabled,this._container=l,this.container.addComponent(new bt("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(i){this.checkDestroyed(),this._automaticDataCollectionEnabled=i}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(i){this._isDeleted=i}checkDestroyed(){if(this.isDeleted)throw st.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _a=zs;function Ks(n,i={}){let s=n;typeof i!="object"&&(i={name:i});const l={name:We,automaticDataCollectionEnabled:!0,...i},g=l.name;if(typeof g!="string"||!g)throw st.create("bad-app-name",{appName:String(g)});if(s||(s=wi()),!s)throw st.create("no-options");const w=Ht.get(g);if(w){if($e(s,w.options)&&$e(l,w.config))return w;throw st.create("duplicate-app",{appName:g})}const v=new Qr(g);for(const C of Xe.values())v.addComponent(C);const S=new Gs(s,l,v);return Ht.set(g,S),S}function Da(n=We){const i=Ht.get(n);if(!i&&n===We&&wi())return Ks();if(!i)throw st.create("no-app",{appName:n});return i}function Oa(){return Array.from(Ht.values())}function wt(n,i,s){let l=Ws[n]??n;s&&(l+=`-${s}`);const g=l.match(/\s|\//),w=i.match(/\s|\//);if(g||w){const v=[`Unable to register library "${l}" with version "${i}":`];g&&v.push(`library name "${l}" contains illegal characters (whitespace or "/")`),g&&w&&v.push("and"),w&&v.push(`version name "${i}" contains illegal characters (whitespace or "/")`),J.warn(v.join(" "));return}Ft(new bt(`${l}-version`,()=>({library:l,version:i}),"VERSION"))}function Ra(n){ss(n)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Js="firebase-heartbeat-database",Ys=1,$t="firebase-heartbeat-store";let Ne=null;function _i(){return Ne||(Ne=Ai(Js,Ys,{upgrade:(n,i)=>{switch(i){case 0:try{n.createObjectStore($t)}catch(s){console.warn(s)}}}}).catch(n=>{throw st.create("idb-open",{originalErrorMessage:n.message})})),Ne}async function Zs(n){try{const s=(await _i()).transaction($t),l=await s.objectStore($t).get(Di(n));return await s.done,l}catch(i){if(i instanceof Et)J.warn(i.message);else{const s=st.create("idb-get",{originalErrorMessage:i==null?void 0:i.message});J.warn(s.message)}}}async function ui(n,i){try{const l=(await _i()).transaction($t,"readwrite");await l.objectStore($t).put(i,Di(n)),await l.done}catch(s){if(s instanceof Et)J.warn(s.message);else{const l=st.create("idb-set",{originalErrorMessage:s==null?void 0:s.message});J.warn(l.message)}}}function Di(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Qs=1024,to=30;class eo{constructor(i){this.container=i,this._heartbeatsCache=null;const s=this.container.getProvider("app").getImmediate();this._storage=new io(s),this._heartbeatsCachePromise=this._storage.read().then(l=>(this._heartbeatsCache=l,l))}async triggerHeartbeat(){var i,s;try{const g=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),w=fi();if(((i=this._heartbeatsCache)==null?void 0:i.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((s=this._heartbeatsCache)==null?void 0:s.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===w||this._heartbeatsCache.heartbeats.some(v=>v.date===w))return;if(this._heartbeatsCache.heartbeats.push({date:w,agent:g}),this._heartbeatsCache.heartbeats.length>to){const v=ro(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(v,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(l){J.warn(l)}}async getHeartbeatsHeader(){var i;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((i=this._heartbeatsCache)==null?void 0:i.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const s=fi(),{heartbeatsToSend:l,unsentEntries:g}=no(this._heartbeatsCache.heartbeats),w=re(JSON.stringify({version:2,heartbeats:l}));return this._heartbeatsCache.lastSentHeartbeatDate=s,g.length>0?(this._heartbeatsCache.heartbeats=g,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),w}catch(s){return J.warn(s),""}}}function fi(){return new Date().toISOString().substring(0,10)}function no(n,i=Qs){const s=[];let l=n.slice();for(const g of n){const w=s.find(v=>v.agent===g.agent);if(w){if(w.dates.push(g.date),pi(s)>i){w.dates.pop();break}}else if(s.push({agent:g.agent,dates:[g.date]}),pi(s)>i){s.pop();break}l=l.slice(1)}return{heartbeatsToSend:s,unsentEntries:l}}class io{constructor(i){this.app=i,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Lr()?Hr().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const s=await Zs(this.app);return s!=null&&s.heartbeats?s:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(i){if(await this._canUseIndexedDBPromise){const l=await this.read();return ui(this.app,{lastSentHeartbeatDate:i.lastSentHeartbeatDate??l.lastSentHeartbeatDate,heartbeats:i.heartbeats})}else return}async add(i){if(await this._canUseIndexedDBPromise){const l=await this.read();return ui(this.app,{lastSentHeartbeatDate:i.lastSentHeartbeatDate??l.lastSentHeartbeatDate,heartbeats:[...l.heartbeats,...i.heartbeats]})}else return}}function pi(n){return re(JSON.stringify({version:2,heartbeats:n})).length}function ro(n){if(n.length===0)return-1;let i=0,s=n[0].date;for(let l=1;l<n.length;l++)n[l].date<s&&(s=n[l].date,i=l);return i}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function so(n){Ft(new bt("platform-logger",i=>new ms(i),"PRIVATE")),Ft(new bt("heartbeat",i=>new eo(i),"PRIVATE")),wt(ze,li,n),wt(ze,li,"esm2020"),wt("fire-js","")}so("");var gi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var oo,ao;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function i(f,a){function c(){}c.prototype=a.prototype,f.F=a.prototype,f.prototype=new c,f.prototype.constructor=f,f.D=function(p,u,m){for(var h=Array(arguments.length-2),$=2;$<arguments.length;$++)h[$-2]=arguments[$];return a.prototype[u].apply(p,h)}}function s(){this.blockSize=-1}function l(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}i(l,s),l.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function g(f,a,c){c||(c=0);const p=Array(16);if(typeof a=="string")for(var u=0;u<16;++u)p[u]=a.charCodeAt(c++)|a.charCodeAt(c++)<<8|a.charCodeAt(c++)<<16|a.charCodeAt(c++)<<24;else for(u=0;u<16;++u)p[u]=a[c++]|a[c++]<<8|a[c++]<<16|a[c++]<<24;a=f.g[0],c=f.g[1],u=f.g[2];let m=f.g[3],h;h=a+(m^c&(u^m))+p[0]+3614090360&4294967295,a=c+(h<<7&4294967295|h>>>25),h=m+(u^a&(c^u))+p[1]+3905402710&4294967295,m=a+(h<<12&4294967295|h>>>20),h=u+(c^m&(a^c))+p[2]+606105819&4294967295,u=m+(h<<17&4294967295|h>>>15),h=c+(a^u&(m^a))+p[3]+3250441966&4294967295,c=u+(h<<22&4294967295|h>>>10),h=a+(m^c&(u^m))+p[4]+4118548399&4294967295,a=c+(h<<7&4294967295|h>>>25),h=m+(u^a&(c^u))+p[5]+1200080426&4294967295,m=a+(h<<12&4294967295|h>>>20),h=u+(c^m&(a^c))+p[6]+2821735955&4294967295,u=m+(h<<17&4294967295|h>>>15),h=c+(a^u&(m^a))+p[7]+4249261313&4294967295,c=u+(h<<22&4294967295|h>>>10),h=a+(m^c&(u^m))+p[8]+1770035416&4294967295,a=c+(h<<7&4294967295|h>>>25),h=m+(u^a&(c^u))+p[9]+2336552879&4294967295,m=a+(h<<12&4294967295|h>>>20),h=u+(c^m&(a^c))+p[10]+4294925233&4294967295,u=m+(h<<17&4294967295|h>>>15),h=c+(a^u&(m^a))+p[11]+2304563134&4294967295,c=u+(h<<22&4294967295|h>>>10),h=a+(m^c&(u^m))+p[12]+1804603682&4294967295,a=c+(h<<7&4294967295|h>>>25),h=m+(u^a&(c^u))+p[13]+4254626195&4294967295,m=a+(h<<12&4294967295|h>>>20),h=u+(c^m&(a^c))+p[14]+2792965006&4294967295,u=m+(h<<17&4294967295|h>>>15),h=c+(a^u&(m^a))+p[15]+1236535329&4294967295,c=u+(h<<22&4294967295|h>>>10),h=a+(u^m&(c^u))+p[1]+4129170786&4294967295,a=c+(h<<5&4294967295|h>>>27),h=m+(c^u&(a^c))+p[6]+3225465664&4294967295,m=a+(h<<9&4294967295|h>>>23),h=u+(a^c&(m^a))+p[11]+643717713&4294967295,u=m+(h<<14&4294967295|h>>>18),h=c+(m^a&(u^m))+p[0]+3921069994&4294967295,c=u+(h<<20&4294967295|h>>>12),h=a+(u^m&(c^u))+p[5]+3593408605&4294967295,a=c+(h<<5&4294967295|h>>>27),h=m+(c^u&(a^c))+p[10]+38016083&4294967295,m=a+(h<<9&4294967295|h>>>23),h=u+(a^c&(m^a))+p[15]+3634488961&4294967295,u=m+(h<<14&4294967295|h>>>18),h=c+(m^a&(u^m))+p[4]+3889429448&4294967295,c=u+(h<<20&4294967295|h>>>12),h=a+(u^m&(c^u))+p[9]+568446438&4294967295,a=c+(h<<5&4294967295|h>>>27),h=m+(c^u&(a^c))+p[14]+3275163606&4294967295,m=a+(h<<9&4294967295|h>>>23),h=u+(a^c&(m^a))+p[3]+4107603335&4294967295,u=m+(h<<14&4294967295|h>>>18),h=c+(m^a&(u^m))+p[8]+1163531501&4294967295,c=u+(h<<20&4294967295|h>>>12),h=a+(u^m&(c^u))+p[13]+2850285829&4294967295,a=c+(h<<5&4294967295|h>>>27),h=m+(c^u&(a^c))+p[2]+4243563512&4294967295,m=a+(h<<9&4294967295|h>>>23),h=u+(a^c&(m^a))+p[7]+1735328473&4294967295,u=m+(h<<14&4294967295|h>>>18),h=c+(m^a&(u^m))+p[12]+2368359562&4294967295,c=u+(h<<20&4294967295|h>>>12),h=a+(c^u^m)+p[5]+4294588738&4294967295,a=c+(h<<4&4294967295|h>>>28),h=m+(a^c^u)+p[8]+2272392833&4294967295,m=a+(h<<11&4294967295|h>>>21),h=u+(m^a^c)+p[11]+1839030562&4294967295,u=m+(h<<16&4294967295|h>>>16),h=c+(u^m^a)+p[14]+4259657740&4294967295,c=u+(h<<23&4294967295|h>>>9),h=a+(c^u^m)+p[1]+2763975236&4294967295,a=c+(h<<4&4294967295|h>>>28),h=m+(a^c^u)+p[4]+1272893353&4294967295,m=a+(h<<11&4294967295|h>>>21),h=u+(m^a^c)+p[7]+4139469664&4294967295,u=m+(h<<16&4294967295|h>>>16),h=c+(u^m^a)+p[10]+3200236656&4294967295,c=u+(h<<23&4294967295|h>>>9),h=a+(c^u^m)+p[13]+681279174&4294967295,a=c+(h<<4&4294967295|h>>>28),h=m+(a^c^u)+p[0]+3936430074&4294967295,m=a+(h<<11&4294967295|h>>>21),h=u+(m^a^c)+p[3]+3572445317&4294967295,u=m+(h<<16&4294967295|h>>>16),h=c+(u^m^a)+p[6]+76029189&4294967295,c=u+(h<<23&4294967295|h>>>9),h=a+(c^u^m)+p[9]+3654602809&4294967295,a=c+(h<<4&4294967295|h>>>28),h=m+(a^c^u)+p[12]+3873151461&4294967295,m=a+(h<<11&4294967295|h>>>21),h=u+(m^a^c)+p[15]+530742520&4294967295,u=m+(h<<16&4294967295|h>>>16),h=c+(u^m^a)+p[2]+3299628645&4294967295,c=u+(h<<23&4294967295|h>>>9),h=a+(u^(c|~m))+p[0]+4096336452&4294967295,a=c+(h<<6&4294967295|h>>>26),h=m+(c^(a|~u))+p[7]+1126891415&4294967295,m=a+(h<<10&4294967295|h>>>22),h=u+(a^(m|~c))+p[14]+2878612391&4294967295,u=m+(h<<15&4294967295|h>>>17),h=c+(m^(u|~a))+p[5]+4237533241&4294967295,c=u+(h<<21&4294967295|h>>>11),h=a+(u^(c|~m))+p[12]+1700485571&4294967295,a=c+(h<<6&4294967295|h>>>26),h=m+(c^(a|~u))+p[3]+2399980690&4294967295,m=a+(h<<10&4294967295|h>>>22),h=u+(a^(m|~c))+p[10]+4293915773&4294967295,u=m+(h<<15&4294967295|h>>>17),h=c+(m^(u|~a))+p[1]+2240044497&4294967295,c=u+(h<<21&4294967295|h>>>11),h=a+(u^(c|~m))+p[8]+1873313359&4294967295,a=c+(h<<6&4294967295|h>>>26),h=m+(c^(a|~u))+p[15]+4264355552&4294967295,m=a+(h<<10&4294967295|h>>>22),h=u+(a^(m|~c))+p[6]+2734768916&4294967295,u=m+(h<<15&4294967295|h>>>17),h=c+(m^(u|~a))+p[13]+1309151649&4294967295,c=u+(h<<21&4294967295|h>>>11),h=a+(u^(c|~m))+p[4]+4149444226&4294967295,a=c+(h<<6&4294967295|h>>>26),h=m+(c^(a|~u))+p[11]+3174756917&4294967295,m=a+(h<<10&4294967295|h>>>22),h=u+(a^(m|~c))+p[2]+718787259&4294967295,u=m+(h<<15&4294967295|h>>>17),h=c+(m^(u|~a))+p[9]+3951481745&4294967295,f.g[0]=f.g[0]+a&4294967295,f.g[1]=f.g[1]+(u+(h<<21&4294967295|h>>>11))&4294967295,f.g[2]=f.g[2]+u&4294967295,f.g[3]=f.g[3]+m&4294967295}l.prototype.v=function(f,a){a===void 0&&(a=f.length);const c=a-this.blockSize,p=this.C;let u=this.h,m=0;for(;m<a;){if(u==0)for(;m<=c;)g(this,f,m),m+=this.blockSize;if(typeof f=="string"){for(;m<a;)if(p[u++]=f.charCodeAt(m++),u==this.blockSize){g(this,p),u=0;break}}else for(;m<a;)if(p[u++]=f[m++],u==this.blockSize){g(this,p),u=0;break}}this.h=u,this.o+=a},l.prototype.A=function(){var f=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);f[0]=128;for(var a=1;a<f.length-8;++a)f[a]=0;a=this.o*8;for(var c=f.length-8;c<f.length;++c)f[c]=a&255,a/=256;for(this.v(f),f=Array(16),a=0,c=0;c<4;++c)for(let p=0;p<32;p+=8)f[a++]=this.g[c]>>>p&255;return f};function w(f,a){var c=S;return Object.prototype.hasOwnProperty.call(c,f)?c[f]:c[f]=a(f)}function v(f,a){this.h=a;const c=[];let p=!0;for(let u=f.length-1;u>=0;u--){const m=f[u]|0;p&&m==a||(c[u]=m,p=!1)}this.g=c}var S={};function C(f){return-128<=f&&f<128?w(f,function(a){return new v([a|0],a<0?-1:0)}):new v([f|0],f<0?-1:0)}function E(f){if(isNaN(f)||!isFinite(f))return T;if(f<0)return R(E(-f));const a=[];let c=1;for(let p=0;f>=c;p++)a[p]=f/c|0,c*=4294967296;return new v(a,0)}function F(f,a){if(f.length==0)throw Error("number format error: empty string");if(a=a||10,a<2||36<a)throw Error("radix out of range: "+a);if(f.charAt(0)=="-")return R(F(f.substring(1),a));if(f.indexOf("-")>=0)throw Error('number format error: interior "-" character');const c=E(Math.pow(a,8));let p=T;for(let m=0;m<f.length;m+=8){var u=Math.min(8,f.length-m);const h=parseInt(f.substring(m,m+u),a);u<8?(u=E(Math.pow(a,u)),p=p.j(u).add(E(h))):(p=p.j(c),p=p.add(E(h)))}return p}var T=C(0),I=C(1),k=C(16777216);n=v.prototype,n.m=function(){if(j(this))return-R(this).m();let f=0,a=1;for(let c=0;c<this.g.length;c++){const p=this.i(c);f+=(p>=0?p:4294967296+p)*a,a*=4294967296}return f},n.toString=function(f){if(f=f||10,f<2||36<f)throw Error("radix out of range: "+f);if(B(this))return"0";if(j(this))return"-"+R(this).toString(f);const a=E(Math.pow(f,6));var c=this;let p="";for(;;){const u=Y(c,a).g;c=G(c,u.j(a));let m=((c.g.length>0?c.g[0]:c.h)>>>0).toString(f);if(c=u,B(c))return m+p;for(;m.length<6;)m="0"+m;p=m+p}},n.i=function(f){return f<0?0:f<this.g.length?this.g[f]:this.h};function B(f){if(f.h!=0)return!1;for(let a=0;a<f.g.length;a++)if(f.g[a]!=0)return!1;return!0}function j(f){return f.h==-1}n.l=function(f){return f=G(this,f),j(f)?-1:B(f)?0:1};function R(f){const a=f.g.length,c=[];for(let p=0;p<a;p++)c[p]=~f.g[p];return new v(c,~f.h).add(I)}n.abs=function(){return j(this)?R(this):this},n.add=function(f){const a=Math.max(this.g.length,f.g.length),c=[];let p=0;for(let u=0;u<=a;u++){let m=p+(this.i(u)&65535)+(f.i(u)&65535),h=(m>>>16)+(this.i(u)>>>16)+(f.i(u)>>>16);p=h>>>16,m&=65535,h&=65535,c[u]=h<<16|m}return new v(c,c[c.length-1]&-2147483648?-1:0)};function G(f,a){return f.add(R(a))}n.j=function(f){if(B(this)||B(f))return T;if(j(this))return j(f)?R(this).j(R(f)):R(R(this).j(f));if(j(f))return R(this.j(R(f)));if(this.l(k)<0&&f.l(k)<0)return E(this.m()*f.m());const a=this.g.length+f.g.length,c=[];for(var p=0;p<2*a;p++)c[p]=0;for(p=0;p<this.g.length;p++)for(let u=0;u<f.g.length;u++){const m=this.i(p)>>>16,h=this.i(p)&65535,$=f.i(u)>>>16,ot=f.i(u)&65535;c[2*p+2*u]+=h*ot,W(c,2*p+2*u),c[2*p+2*u+1]+=m*ot,W(c,2*p+2*u+1),c[2*p+2*u+1]+=h*$,W(c,2*p+2*u+1),c[2*p+2*u+2]+=m*$,W(c,2*p+2*u+2)}for(f=0;f<a;f++)c[f]=c[2*f+1]<<16|c[2*f];for(f=a;f<2*a;f++)c[f]=0;return new v(c,0)};function W(f,a){for(;(f[a]&65535)!=f[a];)f[a+1]+=f[a]>>>16,f[a]&=65535,a++}function V(f,a){this.g=f,this.h=a}function Y(f,a){if(B(a))throw Error("division by zero");if(B(f))return new V(T,T);if(j(f))return a=Y(R(f),a),new V(R(a.g),R(a.h));if(j(a))return a=Y(f,R(a)),new V(R(a.g),a.h);if(f.g.length>30){if(j(f)||j(a))throw Error("slowDivide_ only works with positive integers.");for(var c=I,p=a;p.l(f)<=0;)c=Z(c),p=Z(p);var u=z(c,1),m=z(p,1);for(p=z(p,2),c=z(c,2);!B(p);){var h=m.add(p);h.l(f)<=0&&(u=u.add(c),m=h),p=z(p,1),c=z(c,1)}return a=G(f,u.j(a)),new V(u,a)}for(u=T;f.l(a)>=0;){for(c=Math.max(1,Math.floor(f.m()/a.m())),p=Math.ceil(Math.log(c)/Math.LN2),p=p<=48?1:Math.pow(2,p-48),m=E(c),h=m.j(a);j(h)||h.l(f)>0;)c-=p,m=E(c),h=m.j(a);B(m)&&(m=I),u=u.add(m),f=G(f,h)}return new V(u,f)}n.B=function(f){return Y(this,f).h},n.and=function(f){const a=Math.max(this.g.length,f.g.length),c=[];for(let p=0;p<a;p++)c[p]=this.i(p)&f.i(p);return new v(c,this.h&f.h)},n.or=function(f){const a=Math.max(this.g.length,f.g.length),c=[];for(let p=0;p<a;p++)c[p]=this.i(p)|f.i(p);return new v(c,this.h|f.h)},n.xor=function(f){const a=Math.max(this.g.length,f.g.length),c=[];for(let p=0;p<a;p++)c[p]=this.i(p)^f.i(p);return new v(c,this.h^f.h)};function Z(f){const a=f.g.length+1,c=[];for(let p=0;p<a;p++)c[p]=f.i(p)<<1|f.i(p-1)>>>31;return new v(c,f.h)}function z(f,a){const c=a>>5;a%=32;const p=f.g.length-c,u=[];for(let m=0;m<p;m++)u[m]=a>0?f.i(m+c)>>>a|f.i(m+c+1)<<32-a:f.i(m+c);return new v(u,f.h)}l.prototype.digest=l.prototype.A,l.prototype.reset=l.prototype.u,l.prototype.update=l.prototype.v,ao=l,v.prototype.add=v.prototype.add,v.prototype.multiply=v.prototype.j,v.prototype.modulo=v.prototype.B,v.prototype.compare=v.prototype.l,v.prototype.toNumber=v.prototype.m,v.prototype.toString=v.prototype.toString,v.prototype.getBits=v.prototype.i,v.fromNumber=E,v.fromString=F,oo=v}).apply(typeof gi<"u"?gi:typeof self<"u"?self:typeof window<"u"?window:{});var ie=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var ho,lo,co,uo,fo,po,go,mo;(function(){var n,i=Object.defineProperty;function s(t){t=[typeof globalThis=="object"&&globalThis,t,typeof window=="object"&&window,typeof self=="object"&&self,typeof ie=="object"&&ie];for(var e=0;e<t.length;++e){var r=t[e];if(r&&r.Math==Math)return r}throw Error("Cannot find global object")}var l=s(this);function g(t,e){if(e)t:{var r=l;t=t.split(".");for(var o=0;o<t.length-1;o++){var d=t[o];if(!(d in r))break t;r=r[d]}t=t[t.length-1],o=r[t],e=e(o),e!=o&&e!=null&&i(r,t,{configurable:!0,writable:!0,value:e})}}g("Symbol.dispose",function(t){return t||Symbol("Symbol.dispose")}),g("Array.prototype.values",function(t){return t||function(){return this[Symbol.iterator]()}}),g("Object.entries",function(t){return t||function(e){var r=[],o;for(o in e)Object.prototype.hasOwnProperty.call(e,o)&&r.push([o,e[o]]);return r}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var w=w||{},v=this||self;function S(t){var e=typeof t;return e=="object"&&t!=null||e=="function"}function C(t,e,r){return t.call.apply(t.bind,arguments)}function E(t,e,r){return E=C,E.apply(null,arguments)}function F(t,e){var r=Array.prototype.slice.call(arguments,1);return function(){var o=r.slice();return o.push.apply(o,arguments),t.apply(this,o)}}function T(t,e){function r(){}r.prototype=e.prototype,t.Z=e.prototype,t.prototype=new r,t.prototype.constructor=t,t.Ob=function(o,d,y){for(var b=Array(arguments.length-2),A=2;A<arguments.length;A++)b[A-2]=arguments[A];return e.prototype[d].apply(o,b)}}var I=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?t=>t&&AsyncContext.Snapshot.wrap(t):t=>t;function k(t){const e=t.length;if(e>0){const r=Array(e);for(let o=0;o<e;o++)r[o]=t[o];return r}return[]}function B(t,e){for(let o=1;o<arguments.length;o++){const d=arguments[o];var r=typeof d;if(r=r!="object"?r:d?Array.isArray(d)?"array":r:"null",r=="array"||r=="object"&&typeof d.length=="number"){r=t.length||0;const y=d.length||0;t.length=r+y;for(let b=0;b<y;b++)t[r+b]=d[b]}else t.push(d)}}class j{constructor(e,r){this.i=e,this.j=r,this.h=0,this.g=null}get(){let e;return this.h>0?(this.h--,e=this.g,this.g=e.next,e.next=null):e=this.i(),e}}function R(t){v.setTimeout(()=>{throw t},0)}function G(){var t=f;let e=null;return t.g&&(e=t.g,t.g=t.g.next,t.g||(t.h=null),e.next=null),e}class W{constructor(){this.h=this.g=null}add(e,r){const o=V.get();o.set(e,r),this.h?this.h.next=o:this.g=o,this.h=o}}var V=new j(()=>new Y,t=>t.reset());class Y{constructor(){this.next=this.g=this.h=null}set(e,r){this.h=e,this.g=r,this.next=null}reset(){this.next=this.g=this.h=null}}let Z,z=!1,f=new W,a=()=>{const t=Promise.resolve(void 0);Z=()=>{t.then(c)}};function c(){for(var t;t=G();){try{t.h.call(t.g)}catch(r){R(r)}var e=V;e.j(t),e.h<100&&(e.h++,t.next=e.g,e.g=t)}z=!1}function p(){this.u=this.u,this.C=this.C}p.prototype.u=!1,p.prototype.dispose=function(){this.u||(this.u=!0,this.N())},p.prototype[Symbol.dispose]=function(){this.dispose()},p.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function u(t,e){this.type=t,this.g=this.target=e,this.defaultPrevented=!1}u.prototype.h=function(){this.defaultPrevented=!0};var m=(function(){if(!v.addEventListener||!Object.defineProperty)return!1;var t=!1,e=Object.defineProperty({},"passive",{get:function(){t=!0}});try{const r=()=>{};v.addEventListener("test",r,e),v.removeEventListener("test",r,e)}catch{}return t})();function h(t){return/^[\s\xa0]*$/.test(t)}function $(t,e){u.call(this,t?t.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,t&&this.init(t,e)}T($,u),$.prototype.init=function(t,e){const r=this.type=t.type,o=t.changedTouches&&t.changedTouches.length?t.changedTouches[0]:null;this.target=t.target||t.srcElement,this.g=e,e=t.relatedTarget,e||(r=="mouseover"?e=t.fromElement:r=="mouseout"&&(e=t.toElement)),this.relatedTarget=e,o?(this.clientX=o.clientX!==void 0?o.clientX:o.pageX,this.clientY=o.clientY!==void 0?o.clientY:o.pageY,this.screenX=o.screenX||0,this.screenY=o.screenY||0):(this.clientX=t.clientX!==void 0?t.clientX:t.pageX,this.clientY=t.clientY!==void 0?t.clientY:t.pageY,this.screenX=t.screenX||0,this.screenY=t.screenY||0),this.button=t.button,this.key=t.key||"",this.ctrlKey=t.ctrlKey,this.altKey=t.altKey,this.shiftKey=t.shiftKey,this.metaKey=t.metaKey,this.pointerId=t.pointerId||0,this.pointerType=t.pointerType,this.state=t.state,this.i=t,t.defaultPrevented&&$.Z.h.call(this)},$.prototype.h=function(){$.Z.h.call(this);const t=this.i;t.preventDefault?t.preventDefault():t.returnValue=!1};var ot="closure_listenable_"+(Math.random()*1e6|0),qi=0;function Gi(t,e,r,o,d){this.listener=t,this.proxy=null,this.src=e,this.type=r,this.capture=!!o,this.ha=d,this.key=++qi,this.da=this.fa=!1}function Ut(t){t.da=!0,t.listener=null,t.proxy=null,t.src=null,t.ha=null}function Vt(t,e,r){for(const o in t)e.call(r,t[o],o,t)}function Ki(t,e){for(const r in t)e.call(void 0,t[r],r,t)}function tn(t){const e={};for(const r in t)e[r]=t[r];return e}const en="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function nn(t,e){let r,o;for(let d=1;d<arguments.length;d++){o=arguments[d];for(r in o)t[r]=o[r];for(let y=0;y<en.length;y++)r=en[y],Object.prototype.hasOwnProperty.call(o,r)&&(t[r]=o[r])}}function zt(t){this.src=t,this.g={},this.h=0}zt.prototype.add=function(t,e,r,o,d){const y=t.toString();t=this.g[y],t||(t=this.g[y]=[],this.h++);const b=ce(t,e,o,d);return b>-1?(e=t[b],r||(e.fa=!1)):(e=new Gi(e,this.src,y,!!o,d),e.fa=r,t.push(e)),e};function le(t,e){const r=e.type;if(r in t.g){var o=t.g[r],d=Array.prototype.indexOf.call(o,e,void 0),y;(y=d>=0)&&Array.prototype.splice.call(o,d,1),y&&(Ut(e),t.g[r].length==0&&(delete t.g[r],t.h--))}}function ce(t,e,r,o){for(let d=0;d<t.length;++d){const y=t[d];if(!y.da&&y.listener==e&&y.capture==!!r&&y.ha==o)return d}return-1}var ue="closure_lm_"+(Math.random()*1e6|0),fe={};function rn(t,e,r,o,d){if(Array.isArray(e)){for(let y=0;y<e.length;y++)rn(t,e[y],r,o,d);return null}return r=an(r),t&&t[ot]?t.J(e,r,S(o)?!!o.capture:!1,d):Ji(t,e,r,!1,o,d)}function Ji(t,e,r,o,d,y){if(!e)throw Error("Invalid event type");const b=S(d)?!!d.capture:!!d;let A=ge(t);if(A||(t[ue]=A=new zt(t)),r=A.add(e,r,o,b,y),r.proxy)return r;if(o=Yi(),r.proxy=o,o.src=t,o.listener=r,t.addEventListener)m||(d=b),d===void 0&&(d=!1),t.addEventListener(e.toString(),o,d);else if(t.attachEvent)t.attachEvent(on(e.toString()),o);else if(t.addListener&&t.removeListener)t.addListener(o);else throw Error("addEventListener and attachEvent are unavailable.");return r}function Yi(){function t(r){return e.call(t.src,t.listener,r)}const e=Zi;return t}function sn(t,e,r,o,d){if(Array.isArray(e))for(var y=0;y<e.length;y++)sn(t,e[y],r,o,d);else o=S(o)?!!o.capture:!!o,r=an(r),t&&t[ot]?(t=t.i,y=String(e).toString(),y in t.g&&(e=t.g[y],r=ce(e,r,o,d),r>-1&&(Ut(e[r]),Array.prototype.splice.call(e,r,1),e.length==0&&(delete t.g[y],t.h--)))):t&&(t=ge(t))&&(e=t.g[e.toString()],t=-1,e&&(t=ce(e,r,o,d)),(r=t>-1?e[t]:null)&&pe(r))}function pe(t){if(typeof t!="number"&&t&&!t.da){var e=t.src;if(e&&e[ot])le(e.i,t);else{var r=t.type,o=t.proxy;e.removeEventListener?e.removeEventListener(r,o,t.capture):e.detachEvent?e.detachEvent(on(r),o):e.addListener&&e.removeListener&&e.removeListener(o),(r=ge(e))?(le(r,t),r.h==0&&(r.src=null,e[ue]=null)):Ut(t)}}}function on(t){return t in fe?fe[t]:fe[t]="on"+t}function Zi(t,e){if(t.da)t=!0;else{e=new $(e,this);const r=t.listener,o=t.ha||t.src;t.fa&&pe(t),t=r.call(o,e)}return t}function ge(t){return t=t[ue],t instanceof zt?t:null}var de="__closure_events_fn_"+(Math.random()*1e9>>>0);function an(t){return typeof t=="function"?t:(t[de]||(t[de]=function(e){return t.handleEvent(e)}),t[de])}function N(){p.call(this),this.i=new zt(this),this.M=this,this.G=null}T(N,p),N.prototype[ot]=!0,N.prototype.removeEventListener=function(t,e,r,o){sn(this,t,e,r,o)};function L(t,e){var r,o=t.G;if(o)for(r=[];o;o=o.G)r.push(o);if(t=t.M,o=e.type||e,typeof e=="string")e=new u(e,t);else if(e instanceof u)e.target=e.target||t;else{var d=e;e=new u(o,t),nn(e,d)}d=!0;let y,b;if(r)for(b=r.length-1;b>=0;b--)y=e.g=r[b],d=Wt(y,o,!0,e)&&d;if(y=e.g=t,d=Wt(y,o,!0,e)&&d,d=Wt(y,o,!1,e)&&d,r)for(b=0;b<r.length;b++)y=e.g=r[b],d=Wt(y,o,!1,e)&&d}N.prototype.N=function(){if(N.Z.N.call(this),this.i){var t=this.i;for(const e in t.g){const r=t.g[e];for(let o=0;o<r.length;o++)Ut(r[o]);delete t.g[e],t.h--}}this.G=null},N.prototype.J=function(t,e,r,o){return this.i.add(String(t),e,!1,r,o)},N.prototype.K=function(t,e,r,o){return this.i.add(String(t),e,!0,r,o)};function Wt(t,e,r,o){if(e=t.i.g[String(e)],!e)return!0;e=e.concat();let d=!0;for(let y=0;y<e.length;++y){const b=e[y];if(b&&!b.da&&b.capture==r){const A=b.listener,P=b.ha||b.src;b.fa&&le(t.i,b),d=A.call(P,o)!==!1&&d}}return d&&!o.defaultPrevented}function Qi(t,e){if(typeof t!="function")if(t&&typeof t.handleEvent=="function")t=E(t.handleEvent,t);else throw Error("Invalid listener argument");return Number(e)>2147483647?-1:v.setTimeout(t,e||0)}function hn(t){t.g=Qi(()=>{t.g=null,t.i&&(t.i=!1,hn(t))},t.l);const e=t.h;t.h=null,t.m.apply(null,e)}class tr extends p{constructor(e,r){super(),this.m=e,this.l=r,this.h=null,this.i=!1,this.g=null}j(e){this.h=arguments,this.g?this.i=!0:hn(this)}N(){super.N(),this.g&&(v.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function It(t){p.call(this),this.h=t,this.g={}}T(It,p);var ln=[];function cn(t){Vt(t.g,function(e,r){this.g.hasOwnProperty(r)&&pe(e)},t),t.g={}}It.prototype.N=function(){It.Z.N.call(this),cn(this)},It.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var me=v.JSON.stringify,er=v.JSON.parse,nr=class{stringify(t){return v.JSON.stringify(t,void 0)}parse(t){return v.JSON.parse(t,void 0)}};function un(){}function fn(){}var St={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function ye(){u.call(this,"d")}T(ye,u);function ve(){u.call(this,"c")}T(ve,u);var at={},pn=null;function Xt(){return pn=pn||new N}at.Ia="serverreachability";function gn(t){u.call(this,at.Ia,t)}T(gn,u);function Ct(t){const e=Xt();L(e,new gn(e))}at.STAT_EVENT="statevent";function dn(t,e){u.call(this,at.STAT_EVENT,t),this.stat=e}T(dn,u);function H(t){const e=Xt();L(e,new dn(e,t))}at.Ja="timingevent";function mn(t,e){u.call(this,at.Ja,t),this.size=e}T(mn,u);function At(t,e){if(typeof t!="function")throw Error("Fn must not be null and must be a function");return v.setTimeout(function(){t()},e)}function Tt(){this.g=!0}Tt.prototype.ua=function(){this.g=!1};function ir(t,e,r,o,d,y){t.info(function(){if(t.g)if(y){var b="",A=y.split("&");for(let _=0;_<A.length;_++){var P=A[_].split("=");if(P.length>1){const x=P[0];P=P[1];const q=x.split("_");b=q.length>=2&&q[1]=="type"?b+(x+"="+P+"&"):b+(x+"=redacted&")}}}else b=null;else b=y;return"XMLHTTP REQ ("+o+") [attempt "+d+"]: "+e+`
`+r+`
`+b})}function rr(t,e,r,o,d,y,b){t.info(function(){return"XMLHTTP RESP ("+o+") [ attempt "+d+"]: "+e+`
`+r+`
`+y+" "+b})}function mt(t,e,r,o){t.info(function(){return"XMLHTTP TEXT ("+e+"): "+or(t,r)+(o?" "+o:"")})}function sr(t,e){t.info(function(){return"TIMEOUT: "+e})}Tt.prototype.info=function(){};function or(t,e){if(!t.g)return e;if(!e)return null;try{const y=JSON.parse(e);if(y){for(t=0;t<y.length;t++)if(Array.isArray(y[t])){var r=y[t];if(!(r.length<2)){var o=r[1];if(Array.isArray(o)&&!(o.length<1)){var d=o[0];if(d!="noop"&&d!="stop"&&d!="close")for(let b=1;b<o.length;b++)o[b]=""}}}}return me(y)}catch{return e}}var qt={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},yn={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},vn;function we(){}T(we,un),we.prototype.g=function(){return new XMLHttpRequest},vn=new we;function _t(t){return encodeURIComponent(String(t))}function ar(t){var e=1;t=t.split(":");const r=[];for(;e>0&&t.length;)r.push(t.shift()),e--;return t.length&&r.push(t.join(":")),r}function Q(t,e,r,o){this.j=t,this.i=e,this.l=r,this.S=o||1,this.V=new It(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new wn}function wn(){this.i=null,this.g="",this.h=!1}var bn={},be={};function Ee(t,e,r){t.M=1,t.A=Kt(X(e)),t.u=r,t.R=!0,En(t,null)}function En(t,e){t.F=Date.now(),Gt(t),t.B=X(t.A);var r=t.B,o=t.S;Array.isArray(o)||(o=[String(o)]),kn(r.i,"t",o),t.C=0,r=t.j.L,t.h=new wn,t.g=Zn(t.j,r?e:null,!t.u),t.P>0&&(t.O=new tr(E(t.Y,t,t.g),t.P)),e=t.V,r=t.g,o=t.ba;var d="readystatechange";Array.isArray(d)||(d&&(ln[0]=d.toString()),d=ln);for(let y=0;y<d.length;y++){const b=rn(r,d[y],o||e.handleEvent,!1,e.h||e);if(!b)break;e.g[b.key]=b}e=t.J?tn(t.J):{},t.u?(t.v||(t.v="POST"),e["Content-Type"]="application/x-www-form-urlencoded",t.g.ea(t.B,t.v,t.u,e)):(t.v="GET",t.g.ea(t.B,t.v,null,e)),Ct(),ir(t.i,t.v,t.B,t.l,t.S,t.u)}Q.prototype.ba=function(t){t=t.target;const e=this.O;e&&nt(t)==3?e.j():this.Y(t)},Q.prototype.Y=function(t){try{if(t==this.g)t:{const A=nt(this.g),P=this.g.ya(),_=this.g.ca();if(!(A<3)&&(A!=3||this.g&&(this.h.h||this.g.la()||$n(this.g)))){this.K||A!=4||P==7||(P==8||_<=0?Ct(3):Ct(2)),Ie(this);var e=this.g.ca();this.X=e;var r=hr(this);if(this.o=e==200,rr(this.i,this.v,this.B,this.l,this.S,A,e),this.o){if(this.U&&!this.L){e:{if(this.g){var o,d=this.g;if((o=d.g?d.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!h(o)){var y=o;break e}}y=null}if(t=y)mt(this.i,this.l,t,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Se(this,t);else{this.o=!1,this.m=3,H(12),ht(this),Dt(this);break t}}if(this.R){t=!0;let x;for(;!this.K&&this.C<r.length;)if(x=lr(this,r),x==be){A==4&&(this.m=4,H(14),t=!1),mt(this.i,this.l,null,"[Incomplete Response]");break}else if(x==bn){this.m=4,H(15),mt(this.i,this.l,r,"[Invalid Chunk]"),t=!1;break}else mt(this.i,this.l,x,null),Se(this,x);if(In(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),A!=4||r.length!=0||this.h.h||(this.m=1,H(16),t=!1),this.o=this.o&&t,!t)mt(this.i,this.l,r,"[Invalid Chunked Response]"),ht(this),Dt(this);else if(r.length>0&&!this.W){this.W=!0;var b=this.j;b.g==this&&b.aa&&!b.P&&(b.j.info("Great, no buffering proxy detected. Bytes received: "+r.length),Me(b),b.P=!0,H(11))}}else mt(this.i,this.l,r,null),Se(this,r);A==4&&ht(this),this.o&&!this.K&&(A==4?Gn(this.j,this):(this.o=!1,Gt(this)))}else Sr(this.g),e==400&&r.indexOf("Unknown SID")>0?(this.m=3,H(12)):(this.m=0,H(13)),ht(this),Dt(this)}}}catch{}finally{}};function hr(t){if(!In(t))return t.g.la();const e=$n(t.g);if(e==="")return"";let r="";const o=e.length,d=nt(t.g)==4;if(!t.h.i){if(typeof TextDecoder>"u")return ht(t),Dt(t),"";t.h.i=new v.TextDecoder}for(let y=0;y<o;y++)t.h.h=!0,r+=t.h.i.decode(e[y],{stream:!(d&&y==o-1)});return e.length=0,t.h.g+=r,t.C=0,t.h.g}function In(t){return t.g?t.v=="GET"&&t.M!=2&&t.j.Aa:!1}function lr(t,e){var r=t.C,o=e.indexOf(`
`,r);return o==-1?be:(r=Number(e.substring(r,o)),isNaN(r)?bn:(o+=1,o+r>e.length?be:(e=e.slice(o,o+r),t.C=o+r,e)))}Q.prototype.cancel=function(){this.K=!0,ht(this)};function Gt(t){t.T=Date.now()+t.H,Sn(t,t.H)}function Sn(t,e){if(t.D!=null)throw Error("WatchDog timer not null");t.D=At(E(t.aa,t),e)}function Ie(t){t.D&&(v.clearTimeout(t.D),t.D=null)}Q.prototype.aa=function(){this.D=null;const t=Date.now();t-this.T>=0?(sr(this.i,this.B),this.M!=2&&(Ct(),H(17)),ht(this),this.m=2,Dt(this)):Sn(this,this.T-t)};function Dt(t){t.j.I==0||t.K||Gn(t.j,t)}function ht(t){Ie(t);var e=t.O;e&&typeof e.dispose=="function"&&e.dispose(),t.O=null,cn(t.V),t.g&&(e=t.g,t.g=null,e.abort(),e.dispose())}function Se(t,e){try{var r=t.j;if(r.I!=0&&(r.g==t||Ce(r.h,t))){if(!t.L&&Ce(r.h,t)&&r.I==3){try{var o=r.Ba.g.parse(e)}catch{o=null}if(Array.isArray(o)&&o.length==3){var d=o;if(d[0]==0){t:if(!r.v){if(r.g)if(r.g.F+3e3<t.F)te(r),Zt(r);else break t;Re(r),H(18)}}else r.xa=d[1],0<r.xa-r.K&&d[2]<37500&&r.F&&r.A==0&&!r.C&&(r.C=At(E(r.Va,r),6e3));Tn(r.h)<=1&&r.ta&&(r.ta=void 0)}else ct(r,11)}else if((t.L||r.g==t)&&te(r),!h(e))for(d=r.Ba.g.parse(e),e=0;e<d.length;e++){let _=d[e];const x=_[0];if(!(x<=r.K))if(r.K=x,_=_[1],r.I==2)if(_[0]=="c"){r.M=_[1],r.ba=_[2];const q=_[3];q!=null&&(r.ka=q,r.j.info("VER="+r.ka));const ut=_[4];ut!=null&&(r.za=ut,r.j.info("SVER="+r.za));const it=_[5];it!=null&&typeof it=="number"&&it>0&&(o=1.5*it,r.O=o,r.j.info("backChannelRequestTimeoutMs_="+o)),o=r;const rt=t.g;if(rt){const ne=rt.g?rt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(ne){var y=o.h;y.g||ne.indexOf("spdy")==-1&&ne.indexOf("quic")==-1&&ne.indexOf("h2")==-1||(y.j=y.l,y.g=new Set,y.h&&(Ae(y,y.h),y.h=null))}if(o.G){const Be=rt.g?rt.g.getResponseHeader("X-HTTP-Session-Id"):null;Be&&(o.wa=Be,D(o.J,o.G,Be))}}r.I=3,r.l&&r.l.ra(),r.aa&&(r.T=Date.now()-t.F,r.j.info("Handshake RTT: "+r.T+"ms")),o=r;var b=t;if(o.na=Yn(o,o.L?o.ba:null,o.W),b.L){_n(o.h,b);var A=b,P=o.O;P&&(A.H=P),A.D&&(Ie(A),Gt(A)),o.g=b}else Xn(o);r.i.length>0&&Qt(r)}else _[0]!="stop"&&_[0]!="close"||ct(r,7);else r.I==3&&(_[0]=="stop"||_[0]=="close"?_[0]=="stop"?ct(r,7):Oe(r):_[0]!="noop"&&r.l&&r.l.qa(_),r.A=0)}}Ct(4)}catch{}}var cr=class{constructor(t,e){this.g=t,this.map=e}};function Cn(t){this.l=t||10,v.PerformanceNavigationTiming?(t=v.performance.getEntriesByType("navigation"),t=t.length>0&&(t[0].nextHopProtocol=="hq"||t[0].nextHopProtocol=="h2")):t=!!(v.chrome&&v.chrome.loadTimes&&v.chrome.loadTimes()&&v.chrome.loadTimes().wasFetchedViaSpdy),this.j=t?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function An(t){return t.h?!0:t.g?t.g.size>=t.j:!1}function Tn(t){return t.h?1:t.g?t.g.size:0}function Ce(t,e){return t.h?t.h==e:t.g?t.g.has(e):!1}function Ae(t,e){t.g?t.g.add(e):t.h=e}function _n(t,e){t.h&&t.h==e?t.h=null:t.g&&t.g.has(e)&&t.g.delete(e)}Cn.prototype.cancel=function(){if(this.i=Dn(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const t of this.g.values())t.cancel();this.g.clear()}};function Dn(t){if(t.h!=null)return t.i.concat(t.h.G);if(t.g!=null&&t.g.size!==0){let e=t.i;for(const r of t.g.values())e=e.concat(r.G);return e}return k(t.i)}var On=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function ur(t,e){if(t){t=t.split("&");for(let r=0;r<t.length;r++){const o=t[r].indexOf("=");let d,y=null;o>=0?(d=t[r].substring(0,o),y=t[r].substring(o+1)):d=t[r],e(d,y?decodeURIComponent(y.replace(/\+/g," ")):"")}}}function tt(t){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let e;t instanceof tt?(this.l=t.l,Ot(this,t.j),this.o=t.o,this.g=t.g,Rt(this,t.u),this.h=t.h,Te(this,xn(t.i)),this.m=t.m):t&&(e=String(t).match(On))?(this.l=!1,Ot(this,e[1]||"",!0),this.o=Mt(e[2]||""),this.g=Mt(e[3]||"",!0),Rt(this,e[4]),this.h=Mt(e[5]||"",!0),Te(this,e[6]||"",!0),this.m=Mt(e[7]||"")):(this.l=!1,this.i=new Pt(null,this.l))}tt.prototype.toString=function(){const t=[];var e=this.j;e&&t.push(Bt(e,Rn,!0),":");var r=this.g;return(r||e=="file")&&(t.push("//"),(e=this.o)&&t.push(Bt(e,Rn,!0),"@"),t.push(_t(r).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),r=this.u,r!=null&&t.push(":",String(r))),(r=this.h)&&(this.g&&r.charAt(0)!="/"&&t.push("/"),t.push(Bt(r,r.charAt(0)=="/"?gr:pr,!0))),(r=this.i.toString())&&t.push("?",r),(r=this.m)&&t.push("#",Bt(r,mr)),t.join("")},tt.prototype.resolve=function(t){const e=X(this);let r=!!t.j;r?Ot(e,t.j):r=!!t.o,r?e.o=t.o:r=!!t.g,r?e.g=t.g:r=t.u!=null;var o=t.h;if(r)Rt(e,t.u);else if(r=!!t.h){if(o.charAt(0)!="/")if(this.g&&!this.h)o="/"+o;else{var d=e.h.lastIndexOf("/");d!=-1&&(o=e.h.slice(0,d+1)+o)}if(d=o,d==".."||d==".")o="";else if(d.indexOf("./")!=-1||d.indexOf("/.")!=-1){o=d.lastIndexOf("/",0)==0,d=d.split("/");const y=[];for(let b=0;b<d.length;){const A=d[b++];A=="."?o&&b==d.length&&y.push(""):A==".."?((y.length>1||y.length==1&&y[0]!="")&&y.pop(),o&&b==d.length&&y.push("")):(y.push(A),o=!0)}o=y.join("/")}else o=d}return r?e.h=o:r=t.i.toString()!=="",r?Te(e,xn(t.i)):r=!!t.m,r&&(e.m=t.m),e};function X(t){return new tt(t)}function Ot(t,e,r){t.j=r?Mt(e,!0):e,t.j&&(t.j=t.j.replace(/:$/,""))}function Rt(t,e){if(e){if(e=Number(e),isNaN(e)||e<0)throw Error("Bad port number "+e);t.u=e}else t.u=null}function Te(t,e,r){e instanceof Pt?(t.i=e,yr(t.i,t.l)):(r||(e=Bt(e,dr)),t.i=new Pt(e,t.l))}function D(t,e,r){t.i.set(e,r)}function Kt(t){return D(t,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),t}function Mt(t,e){return t?e?decodeURI(t.replace(/%25/g,"%2525")):decodeURIComponent(t):""}function Bt(t,e,r){return typeof t=="string"?(t=encodeURI(t).replace(e,fr),r&&(t=t.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),t):null}function fr(t){return t=t.charCodeAt(0),"%"+(t>>4&15).toString(16)+(t&15).toString(16)}var Rn=/[#\/\?@]/g,pr=/[#\?:]/g,gr=/[#\?]/g,dr=/[#\?@]/g,mr=/#/g;function Pt(t,e){this.h=this.g=null,this.i=t||null,this.j=!!e}function lt(t){t.g||(t.g=new Map,t.h=0,t.i&&ur(t.i,function(e,r){t.add(decodeURIComponent(e.replace(/\+/g," ")),r)}))}n=Pt.prototype,n.add=function(t,e){lt(this),this.i=null,t=yt(this,t);let r=this.g.get(t);return r||this.g.set(t,r=[]),r.push(e),this.h+=1,this};function Mn(t,e){lt(t),e=yt(t,e),t.g.has(e)&&(t.i=null,t.h-=t.g.get(e).length,t.g.delete(e))}function Bn(t,e){return lt(t),e=yt(t,e),t.g.has(e)}n.forEach=function(t,e){lt(this),this.g.forEach(function(r,o){r.forEach(function(d){t.call(e,d,o,this)},this)},this)};function Pn(t,e){lt(t);let r=[];if(typeof e=="string")Bn(t,e)&&(r=r.concat(t.g.get(yt(t,e))));else for(t=Array.from(t.g.values()),e=0;e<t.length;e++)r=r.concat(t[e]);return r}n.set=function(t,e){return lt(this),this.i=null,t=yt(this,t),Bn(this,t)&&(this.h-=this.g.get(t).length),this.g.set(t,[e]),this.h+=1,this},n.get=function(t,e){return t?(t=Pn(this,t),t.length>0?String(t[0]):e):e};function kn(t,e,r){Mn(t,e),r.length>0&&(t.i=null,t.g.set(yt(t,e),k(r)),t.h+=r.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const t=[],e=Array.from(this.g.keys());for(let o=0;o<e.length;o++){var r=e[o];const d=_t(r);r=Pn(this,r);for(let y=0;y<r.length;y++){let b=d;r[y]!==""&&(b+="="+_t(r[y])),t.push(b)}}return this.i=t.join("&")};function xn(t){const e=new Pt;return e.i=t.i,t.g&&(e.g=new Map(t.g),e.h=t.h),e}function yt(t,e){return e=String(e),t.j&&(e=e.toLowerCase()),e}function yr(t,e){e&&!t.j&&(lt(t),t.i=null,t.g.forEach(function(r,o){const d=o.toLowerCase();o!=d&&(Mn(this,o),kn(this,d,r))},t)),t.j=e}function vr(t,e){const r=new Tt;if(v.Image){const o=new Image;o.onload=F(et,r,"TestLoadImage: loaded",!0,e,o),o.onerror=F(et,r,"TestLoadImage: error",!1,e,o),o.onabort=F(et,r,"TestLoadImage: abort",!1,e,o),o.ontimeout=F(et,r,"TestLoadImage: timeout",!1,e,o),v.setTimeout(function(){o.ontimeout&&o.ontimeout()},1e4),o.src=t}else e(!1)}function wr(t,e){const r=new Tt,o=new AbortController,d=setTimeout(()=>{o.abort(),et(r,"TestPingServer: timeout",!1,e)},1e4);fetch(t,{signal:o.signal}).then(y=>{clearTimeout(d),y.ok?et(r,"TestPingServer: ok",!0,e):et(r,"TestPingServer: server error",!1,e)}).catch(()=>{clearTimeout(d),et(r,"TestPingServer: error",!1,e)})}function et(t,e,r,o,d){try{d&&(d.onload=null,d.onerror=null,d.onabort=null,d.ontimeout=null),o(r)}catch{}}function br(){this.g=new nr}function _e(t){this.i=t.Sb||null,this.h=t.ab||!1}T(_e,un),_e.prototype.g=function(){return new Jt(this.i,this.h)};function Jt(t,e){N.call(this),this.H=t,this.o=e,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}T(Jt,N),n=Jt.prototype,n.open=function(t,e){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=t,this.D=e,this.readyState=1,xt(this)},n.send=function(t){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const e={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};t&&(e.body=t),(this.H||v).fetch(new Request(this.D,e)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,kt(this)),this.readyState=0},n.Pa=function(t){if(this.g&&(this.l=t,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=t.headers,this.readyState=2,xt(this)),this.g&&(this.readyState=3,xt(this),this.g)))if(this.responseType==="arraybuffer")t.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof v.ReadableStream<"u"&&"body"in t){if(this.j=t.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;jn(this)}else t.text().then(this.Oa.bind(this),this.ga.bind(this))};function jn(t){t.j.read().then(t.Ma.bind(t)).catch(t.ga.bind(t))}n.Ma=function(t){if(this.g){if(this.o&&t.value)this.response.push(t.value);else if(!this.o){var e=t.value?t.value:new Uint8Array(0);(e=this.B.decode(e,{stream:!t.done}))&&(this.response=this.responseText+=e)}t.done?kt(this):xt(this),this.readyState==3&&jn(this)}},n.Oa=function(t){this.g&&(this.response=this.responseText=t,kt(this))},n.Na=function(t){this.g&&(this.response=t,kt(this))},n.ga=function(){this.g&&kt(this)};function kt(t){t.readyState=4,t.l=null,t.j=null,t.B=null,xt(t)}n.setRequestHeader=function(t,e){this.A.append(t,e)},n.getResponseHeader=function(t){return this.h&&this.h.get(t.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const t=[],e=this.h.entries();for(var r=e.next();!r.done;)r=r.value,t.push(r[0]+": "+r[1]),r=e.next();return t.join(`\r
`)};function xt(t){t.onreadystatechange&&t.onreadystatechange.call(t)}Object.defineProperty(Jt.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(t){this.m=t?"include":"same-origin"}});function Nn(t){let e="";return Vt(t,function(r,o){e+=o,e+=":",e+=r,e+=`\r
`}),e}function De(t,e,r){t:{for(o in r){var o=!1;break t}o=!0}o||(r=Nn(r),typeof t=="string"?r!=null&&_t(r):D(t,e,r))}function M(t){N.call(this),this.headers=new Map,this.L=t||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}T(M,N);var Er=/^https?$/i,Ir=["POST","PUT"];n=M.prototype,n.Fa=function(t){this.H=t},n.ea=function(t,e,r,o){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+t);e=e?e.toUpperCase():"GET",this.D=t,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():vn.g(),this.g.onreadystatechange=I(E(this.Ca,this));try{this.B=!0,this.g.open(e,String(t),!0),this.B=!1}catch(y){Ln(this,y);return}if(t=r||"",r=new Map(this.headers),o)if(Object.getPrototypeOf(o)===Object.prototype)for(var d in o)r.set(d,o[d]);else if(typeof o.keys=="function"&&typeof o.get=="function")for(const y of o.keys())r.set(y,o.get(y));else throw Error("Unknown input type for opt_headers: "+String(o));o=Array.from(r.keys()).find(y=>y.toLowerCase()=="content-type"),d=v.FormData&&t instanceof v.FormData,!(Array.prototype.indexOf.call(Ir,e,void 0)>=0)||o||d||r.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[y,b]of r)this.g.setRequestHeader(y,b);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(t),this.v=!1}catch(y){Ln(this,y)}};function Ln(t,e){t.h=!1,t.g&&(t.j=!0,t.g.abort(),t.j=!1),t.l=e,t.o=5,Hn(t),Yt(t)}function Hn(t){t.A||(t.A=!0,L(t,"complete"),L(t,"error"))}n.abort=function(t){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=t||7,L(this,"complete"),L(this,"abort"),Yt(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Yt(this,!0)),M.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?Fn(this):this.Xa())},n.Xa=function(){Fn(this)};function Fn(t){if(t.h&&typeof w<"u"){if(t.v&&nt(t)==4)setTimeout(t.Ca.bind(t),0);else if(L(t,"readystatechange"),nt(t)==4){t.h=!1;try{const y=t.ca();t:switch(y){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var e=!0;break t;default:e=!1}var r;if(!(r=e)){var o;if(o=y===0){let b=String(t.D).match(On)[1]||null;!b&&v.self&&v.self.location&&(b=v.self.location.protocol.slice(0,-1)),o=!Er.test(b?b.toLowerCase():"")}r=o}if(r)L(t,"complete"),L(t,"success");else{t.o=6;try{var d=nt(t)>2?t.g.statusText:""}catch{d=""}t.l=d+" ["+t.ca()+"]",Hn(t)}}finally{Yt(t)}}}}function Yt(t,e){if(t.g){t.m&&(clearTimeout(t.m),t.m=null);const r=t.g;t.g=null,e||L(t,"ready");try{r.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function nt(t){return t.g?t.g.readyState:0}n.ca=function(){try{return nt(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(t){if(this.g){var e=this.g.responseText;return t&&e.indexOf(t)==0&&(e=e.substring(t.length)),er(e)}};function $n(t){try{if(!t.g)return null;if("response"in t.g)return t.g.response;switch(t.F){case"":case"text":return t.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in t.g)return t.g.mozResponseArrayBuffer}return null}catch{return null}}function Sr(t){const e={};t=(t.g&&nt(t)>=2&&t.g.getAllResponseHeaders()||"").split(`\r
`);for(let o=0;o<t.length;o++){if(h(t[o]))continue;var r=ar(t[o]);const d=r[0];if(r=r[1],typeof r!="string")continue;r=r.trim();const y=e[d]||[];e[d]=y,y.push(r)}Ki(e,function(o){return o.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function jt(t,e,r){return r&&r.internalChannelParams&&r.internalChannelParams[t]||e}function Un(t){this.za=0,this.i=[],this.j=new Tt,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=jt("failFast",!1,t),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=jt("baseRetryDelayMs",5e3,t),this.Za=jt("retryDelaySeedMs",1e4,t),this.Ta=jt("forwardChannelMaxRetries",2,t),this.va=jt("forwardChannelRequestTimeoutMs",2e4,t),this.ma=t&&t.xmlHttpFactory||void 0,this.Ua=t&&t.Rb||void 0,this.Aa=t&&t.useFetchStreams||!1,this.O=void 0,this.L=t&&t.supportsCrossDomainXhr||!1,this.M="",this.h=new Cn(t&&t.concurrentRequestLimit),this.Ba=new br,this.S=t&&t.fastHandshake||!1,this.R=t&&t.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=t&&t.Pb||!1,t&&t.ua&&this.j.ua(),t&&t.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&t&&t.detectBufferingProxy||!1,this.ia=void 0,t&&t.longPollingTimeout&&t.longPollingTimeout>0&&(this.ia=t.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Un.prototype,n.ka=8,n.I=1,n.connect=function(t,e,r,o){H(0),this.W=t,this.H=e||{},r&&o!==void 0&&(this.H.OSID=r,this.H.OAID=o),this.F=this.X,this.J=Yn(this,null,this.W),Qt(this)};function Oe(t){if(Vn(t),t.I==3){var e=t.V++,r=X(t.J);if(D(r,"SID",t.M),D(r,"RID",e),D(r,"TYPE","terminate"),Nt(t,r),e=new Q(t,t.j,e),e.M=2,e.A=Kt(X(r)),r=!1,v.navigator&&v.navigator.sendBeacon)try{r=v.navigator.sendBeacon(e.A.toString(),"")}catch{}!r&&v.Image&&(new Image().src=e.A,r=!0),r||(e.g=Zn(e.j,null),e.g.ea(e.A)),e.F=Date.now(),Gt(e)}Jn(t)}function Zt(t){t.g&&(Me(t),t.g.cancel(),t.g=null)}function Vn(t){Zt(t),t.v&&(v.clearTimeout(t.v),t.v=null),te(t),t.h.cancel(),t.m&&(typeof t.m=="number"&&v.clearTimeout(t.m),t.m=null)}function Qt(t){if(!An(t.h)&&!t.m){t.m=!0;var e=t.Ea;Z||a(),z||(Z(),z=!0),f.add(e,t),t.D=0}}function Cr(t,e){return Tn(t.h)>=t.h.j-(t.m?1:0)?!1:t.m?(t.i=e.G.concat(t.i),!0):t.I==1||t.I==2||t.D>=(t.Sa?0:t.Ta)?!1:(t.m=At(E(t.Ea,t,e),Kn(t,t.D)),t.D++,!0)}n.Ea=function(t){if(this.m)if(this.m=null,this.I==1){if(!t){this.V=Math.floor(Math.random()*1e5),t=this.V++;const d=new Q(this,this.j,t);let y=this.o;if(this.U&&(y?(y=tn(y),nn(y,this.U)):y=this.U),this.u!==null||this.R||(d.J=y,y=null),this.S)t:{for(var e=0,r=0;r<this.i.length;r++){e:{var o=this.i[r];if("__data__"in o.map&&(o=o.map.__data__,typeof o=="string")){o=o.length;break e}o=void 0}if(o===void 0)break;if(e+=o,e>4096){e=r;break t}if(e===4096||r===this.i.length-1){e=r+1;break t}}e=1e3}else e=1e3;e=Wn(this,d,e),r=X(this.J),D(r,"RID",t),D(r,"CVER",22),this.G&&D(r,"X-HTTP-Session-Id",this.G),Nt(this,r),y&&(this.R?e="headers="+_t(Nn(y))+"&"+e:this.u&&De(r,this.u,y)),Ae(this.h,d),this.Ra&&D(r,"TYPE","init"),this.S?(D(r,"$req",e),D(r,"SID","null"),d.U=!0,Ee(d,r,null)):Ee(d,r,e),this.I=2}}else this.I==3&&(t?zn(this,t):this.i.length==0||An(this.h)||zn(this))};function zn(t,e){var r;e?r=e.l:r=t.V++;const o=X(t.J);D(o,"SID",t.M),D(o,"RID",r),D(o,"AID",t.K),Nt(t,o),t.u&&t.o&&De(o,t.u,t.o),r=new Q(t,t.j,r,t.D+1),t.u===null&&(r.J=t.o),e&&(t.i=e.G.concat(t.i)),e=Wn(t,r,1e3),r.H=Math.round(t.va*.5)+Math.round(t.va*.5*Math.random()),Ae(t.h,r),Ee(r,o,e)}function Nt(t,e){t.H&&Vt(t.H,function(r,o){D(e,o,r)}),t.l&&Vt({},function(r,o){D(e,o,r)})}function Wn(t,e,r){r=Math.min(t.i.length,r);const o=t.l?E(t.l.Ka,t.l,t):null;t:{var d=t.i;let A=-1;for(;;){const P=["count="+r];A==-1?r>0?(A=d[0].g,P.push("ofs="+A)):A=0:P.push("ofs="+A);let _=!0;for(let x=0;x<r;x++){var y=d[x].g;const q=d[x].map;if(y-=A,y<0)A=Math.max(0,d[x].g-100),_=!1;else try{y="req"+y+"_"||"";try{var b=q instanceof Map?q:Object.entries(q);for(const[ut,it]of b){let rt=it;S(it)&&(rt=me(it)),P.push(y+ut+"="+encodeURIComponent(rt))}}catch(ut){throw P.push(y+"type="+encodeURIComponent("_badmap")),ut}}catch{o&&o(q)}}if(_){b=P.join("&");break t}}b=void 0}return t=t.i.splice(0,r),e.G=t,b}function Xn(t){if(!t.g&&!t.v){t.Y=1;var e=t.Da;Z||a(),z||(Z(),z=!0),f.add(e,t),t.A=0}}function Re(t){return t.g||t.v||t.A>=3?!1:(t.Y++,t.v=At(E(t.Da,t),Kn(t,t.A)),t.A++,!0)}n.Da=function(){if(this.v=null,qn(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var t=4*this.T;this.j.info("BP detection timer enabled: "+t),this.B=At(E(this.Wa,this),t)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,H(10),Zt(this),qn(this))};function Me(t){t.B!=null&&(v.clearTimeout(t.B),t.B=null)}function qn(t){t.g=new Q(t,t.j,"rpc",t.Y),t.u===null&&(t.g.J=t.o),t.g.P=0;var e=X(t.na);D(e,"RID","rpc"),D(e,"SID",t.M),D(e,"AID",t.K),D(e,"CI",t.F?"0":"1"),!t.F&&t.ia&&D(e,"TO",t.ia),D(e,"TYPE","xmlhttp"),Nt(t,e),t.u&&t.o&&De(e,t.u,t.o),t.O&&(t.g.H=t.O);var r=t.g;t=t.ba,r.M=1,r.A=Kt(X(e)),r.u=null,r.R=!0,En(r,t)}n.Va=function(){this.C!=null&&(this.C=null,Zt(this),Re(this),H(19))};function te(t){t.C!=null&&(v.clearTimeout(t.C),t.C=null)}function Gn(t,e){var r=null;if(t.g==e){te(t),Me(t),t.g=null;var o=2}else if(Ce(t.h,e))r=e.G,_n(t.h,e),o=1;else return;if(t.I!=0){if(e.o)if(o==1){r=e.u?e.u.length:0,e=Date.now()-e.F;var d=t.D;o=Xt(),L(o,new mn(o,r)),Qt(t)}else Xn(t);else if(d=e.m,d==3||d==0&&e.X>0||!(o==1&&Cr(t,e)||o==2&&Re(t)))switch(r&&r.length>0&&(e=t.h,e.i=e.i.concat(r)),d){case 1:ct(t,5);break;case 4:ct(t,10);break;case 3:ct(t,6);break;default:ct(t,2)}}}function Kn(t,e){let r=t.Qa+Math.floor(Math.random()*t.Za);return t.isActive()||(r*=2),r*e}function ct(t,e){if(t.j.info("Error code "+e),e==2){var r=E(t.bb,t),o=t.Ua;const d=!o;o=new tt(o||"//www.google.com/images/cleardot.gif"),v.location&&v.location.protocol=="http"||Ot(o,"https"),Kt(o),d?vr(o.toString(),r):wr(o.toString(),r)}else H(2);t.I=0,t.l&&t.l.pa(e),Jn(t),Vn(t)}n.bb=function(t){t?(this.j.info("Successfully pinged google.com"),H(2)):(this.j.info("Failed to ping google.com"),H(1))};function Jn(t){if(t.I=0,t.ja=[],t.l){const e=Dn(t.h);(e.length!=0||t.i.length!=0)&&(B(t.ja,e),B(t.ja,t.i),t.h.i.length=0,k(t.i),t.i.length=0),t.l.oa()}}function Yn(t,e,r){var o=r instanceof tt?X(r):new tt(r);if(o.g!="")e&&(o.g=e+"."+o.g),Rt(o,o.u);else{var d=v.location;o=d.protocol,e=e?e+"."+d.hostname:d.hostname,d=+d.port;const y=new tt(null);o&&Ot(y,o),e&&(y.g=e),d&&Rt(y,d),r&&(y.h=r),o=y}return r=t.G,e=t.wa,r&&e&&D(o,r,e),D(o,"VER",t.ka),Nt(t,o),o}function Zn(t,e,r){if(e&&!t.L)throw Error("Can't create secondary domain capable XhrIo object.");return e=t.Aa&&!t.ma?new M(new _e({ab:r})):new M(t.ma),e.Fa(t.L),e}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function Qn(){}n=Qn.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function ee(){}ee.prototype.g=function(t,e){return new U(t,e)};function U(t,e){N.call(this),this.g=new Un(e),this.l=t,this.h=e&&e.messageUrlParams||null,t=e&&e.messageHeaders||null,e&&e.clientProtocolHeaderRequired&&(t?t["X-Client-Protocol"]="webchannel":t={"X-Client-Protocol":"webchannel"}),this.g.o=t,t=e&&e.initMessageHeaders||null,e&&e.messageContentType&&(t?t["X-WebChannel-Content-Type"]=e.messageContentType:t={"X-WebChannel-Content-Type":e.messageContentType}),e&&e.sa&&(t?t["X-WebChannel-Client-Profile"]=e.sa:t={"X-WebChannel-Client-Profile":e.sa}),this.g.U=t,(t=e&&e.Qb)&&!h(t)&&(this.g.u=t),this.A=e&&e.supportsCrossDomainXhr||!1,this.v=e&&e.sendRawJson||!1,(e=e&&e.httpSessionIdParam)&&!h(e)&&(this.g.G=e,t=this.h,t!==null&&e in t&&(t=this.h,e in t&&delete t[e])),this.j=new vt(this)}T(U,N),U.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},U.prototype.close=function(){Oe(this.g)},U.prototype.o=function(t){var e=this.g;if(typeof t=="string"){var r={};r.__data__=t,t=r}else this.v&&(r={},r.__data__=me(t),t=r);e.i.push(new cr(e.Ya++,t)),e.I==3&&Qt(e)},U.prototype.N=function(){this.g.l=null,delete this.j,Oe(this.g),delete this.g,U.Z.N.call(this)};function ti(t){ye.call(this),t.__headers__&&(this.headers=t.__headers__,this.statusCode=t.__status__,delete t.__headers__,delete t.__status__);var e=t.__sm__;if(e){t:{for(const r in e){t=r;break t}t=void 0}(this.i=t)&&(t=this.i,e=e!==null&&t in e?e[t]:void 0),this.data=e}else this.data=t}T(ti,ye);function ei(){ve.call(this),this.status=1}T(ei,ve);function vt(t){this.g=t}T(vt,Qn),vt.prototype.ra=function(){L(this.g,"a")},vt.prototype.qa=function(t){L(this.g,new ti(t))},vt.prototype.pa=function(t){L(this.g,new ei)},vt.prototype.oa=function(){L(this.g,"b")},ee.prototype.createWebChannel=ee.prototype.g,U.prototype.send=U.prototype.o,U.prototype.open=U.prototype.m,U.prototype.close=U.prototype.close,mo=function(){return new ee},go=function(){return Xt()},po=at,fo={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},qt.NO_ERROR=0,qt.TIMEOUT=8,qt.HTTP_ERROR=6,uo=qt,yn.COMPLETE="complete",co=yn,fn.EventType=St,St.OPEN="a",St.CLOSE="b",St.ERROR="c",St.MESSAGE="d",N.prototype.listen=N.prototype.J,lo=fn,M.prototype.listenOnce=M.prototype.K,M.prototype.getLastError=M.prototype.Ha,M.prototype.getLastErrorCode=M.prototype.ya,M.prototype.getStatus=M.prototype.ca,M.prototype.getResponseJson=M.prototype.La,M.prototype.getResponseText=M.prototype.la,M.prototype.send=M.prototype.ea,M.prototype.setWithCredentials=M.prototype.Fa,ho=M}).apply(typeof ie<"u"?ie:typeof self<"u"?self:typeof window<"u"?window:{});var yo="firebase",vo="12.8.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */wt(yo,vo,"app");const Oi="@firebase/installations",Je="0.6.19";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ri=1e4,Mi=`w:${Je}`,Bi="FIS_v2",wo="https://firebaseinstallations.googleapis.com/v1",bo=3600*1e3,Eo="installations",Io="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const So={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},gt=new Ge(Eo,Io,So);function Pi(n){return n instanceof Et&&n.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ki({projectId:n}){return`${wo}/projects/${n}/installations`}function xi(n){return{token:n.token,requestStatus:2,expiresIn:Ao(n.expiresIn),creationTime:Date.now()}}async function ji(n,i){const l=(await i.json()).error;return gt.create("request-failed",{requestName:n,serverCode:l.code,serverMessage:l.message,serverStatus:l.status})}function Ni({apiKey:n}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":n})}function Co(n,{refreshToken:i}){const s=Ni(n);return s.append("Authorization",To(i)),s}async function Li(n){const i=await n();return i.status>=500&&i.status<600?n():i}function Ao(n){return Number(n.replace("s","000"))}function To(n){return`${Bi} ${n}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _o({appConfig:n,heartbeatServiceProvider:i},{fid:s}){const l=ki(n),g=Ni(n),w=i.getImmediate({optional:!0});if(w){const E=await w.getHeartbeatsHeader();E&&g.append("x-firebase-client",E)}const v={fid:s,authVersion:Bi,appId:n.appId,sdkVersion:Mi},S={method:"POST",headers:g,body:JSON.stringify(v)},C=await Li(()=>fetch(l,S));if(C.ok){const E=await C.json();return{fid:E.fid||s,registrationStatus:2,refreshToken:E.refreshToken,authToken:xi(E.authToken)}}else throw await ji("Create Installation",C)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Hi(n){return new Promise(i=>{setTimeout(i,n)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Do(n){return btoa(String.fromCharCode(...n)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Oo=/^[cdef][\w-]{21}$/,qe="";function Ro(){try{const n=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(n),n[0]=112+n[0]%16;const s=Mo(n);return Oo.test(s)?s:qe}catch{return qe}}function Mo(n){return Do(n).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ae(n){return`${n.appName}!${n.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fi=new Map;function $i(n,i){const s=ae(n);Ui(s,i),Bo(s,i)}function Ui(n,i){const s=Fi.get(n);if(s)for(const l of s)l(i)}function Bo(n,i){const s=Po();s&&s.postMessage({key:n,fid:i}),ko()}let pt=null;function Po(){return!pt&&"BroadcastChannel"in self&&(pt=new BroadcastChannel("[Firebase] FID Change"),pt.onmessage=n=>{Ui(n.data.key,n.data.fid)}),pt}function ko(){Fi.size===0&&pt&&(pt.close(),pt=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xo="firebase-installations-database",jo=1,dt="firebase-installations-store";let Le=null;function Ye(){return Le||(Le=Ai(xo,jo,{upgrade:(n,i)=>{switch(i){case 0:n.createObjectStore(dt)}}})),Le}async function se(n,i){const s=ae(n),g=(await Ye()).transaction(dt,"readwrite"),w=g.objectStore(dt),v=await w.get(s);return await w.put(i,s),await g.done,(!v||v.fid!==i.fid)&&$i(n,i.fid),i}async function Vi(n){const i=ae(n),l=(await Ye()).transaction(dt,"readwrite");await l.objectStore(dt).delete(i),await l.done}async function he(n,i){const s=ae(n),g=(await Ye()).transaction(dt,"readwrite"),w=g.objectStore(dt),v=await w.get(s),S=i(v);return S===void 0?await w.delete(s):await w.put(S,s),await g.done,S&&(!v||v.fid!==S.fid)&&$i(n,S.fid),S}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ze(n){let i;const s=await he(n.appConfig,l=>{const g=No(l),w=Lo(n,g);return i=w.registrationPromise,w.installationEntry});return s.fid===qe?{installationEntry:await i}:{installationEntry:s,registrationPromise:i}}function No(n){const i=n||{fid:Ro(),registrationStatus:0};return zi(i)}function Lo(n,i){if(i.registrationStatus===0){if(!navigator.onLine){const g=Promise.reject(gt.create("app-offline"));return{installationEntry:i,registrationPromise:g}}const s={fid:i.fid,registrationStatus:1,registrationTime:Date.now()},l=Ho(n,s);return{installationEntry:s,registrationPromise:l}}else return i.registrationStatus===1?{installationEntry:i,registrationPromise:Fo(n)}:{installationEntry:i}}async function Ho(n,i){try{const s=await _o(n,i);return se(n.appConfig,s)}catch(s){throw Pi(s)&&s.customData.serverCode===409?await Vi(n.appConfig):await se(n.appConfig,{fid:i.fid,registrationStatus:0}),s}}async function Fo(n){let i=await di(n.appConfig);for(;i.registrationStatus===1;)await Hi(100),i=await di(n.appConfig);if(i.registrationStatus===0){const{installationEntry:s,registrationPromise:l}=await Ze(n);return l||s}return i}function di(n){return he(n,i=>{if(!i)throw gt.create("installation-not-found");return zi(i)})}function zi(n){return $o(n)?{fid:n.fid,registrationStatus:0}:n}function $o(n){return n.registrationStatus===1&&n.registrationTime+Ri<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Uo({appConfig:n,heartbeatServiceProvider:i},s){const l=Vo(n,s),g=Co(n,s),w=i.getImmediate({optional:!0});if(w){const E=await w.getHeartbeatsHeader();E&&g.append("x-firebase-client",E)}const v={installation:{sdkVersion:Mi,appId:n.appId}},S={method:"POST",headers:g,body:JSON.stringify(v)},C=await Li(()=>fetch(l,S));if(C.ok){const E=await C.json();return xi(E)}else throw await ji("Generate Auth Token",C)}function Vo(n,{fid:i}){return`${ki(n)}/${i}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Qe(n,i=!1){let s;const l=await he(n.appConfig,w=>{if(!Wi(w))throw gt.create("not-registered");const v=w.authToken;if(!i&&Xo(v))return w;if(v.requestStatus===1)return s=zo(n,i),w;{if(!navigator.onLine)throw gt.create("app-offline");const S=Go(w);return s=Wo(n,S),S}});return s?await s:l.authToken}async function zo(n,i){let s=await mi(n.appConfig);for(;s.authToken.requestStatus===1;)await Hi(100),s=await mi(n.appConfig);const l=s.authToken;return l.requestStatus===0?Qe(n,i):l}function mi(n){return he(n,i=>{if(!Wi(i))throw gt.create("not-registered");const s=i.authToken;return Ko(s)?{...i,authToken:{requestStatus:0}}:i})}async function Wo(n,i){try{const s=await Uo(n,i),l={...i,authToken:s};return await se(n.appConfig,l),s}catch(s){if(Pi(s)&&(s.customData.serverCode===401||s.customData.serverCode===404))await Vi(n.appConfig);else{const l={...i,authToken:{requestStatus:0}};await se(n.appConfig,l)}throw s}}function Wi(n){return n!==void 0&&n.registrationStatus===2}function Xo(n){return n.requestStatus===2&&!qo(n)}function qo(n){const i=Date.now();return i<n.creationTime||n.creationTime+n.expiresIn<i+bo}function Go(n){const i={requestStatus:1,requestTime:Date.now()};return{...n,authToken:i}}function Ko(n){return n.requestStatus===1&&n.requestTime+Ri<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Jo(n){const i=n,{installationEntry:s,registrationPromise:l}=await Ze(i);return l?l.catch(console.error):Qe(i).catch(console.error),s.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Yo(n,i=!1){const s=n;return await Zo(s),(await Qe(s,i)).token}async function Zo(n){const{registrationPromise:i}=await Ze(n);i&&await i}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qo(n){if(!n||!n.options)throw He("App Configuration");if(!n.name)throw He("App Name");const i=["projectId","apiKey","appId"];for(const s of i)if(!n.options[s])throw He(s);return{appName:n.name,projectId:n.options.projectId,apiKey:n.options.apiKey,appId:n.options.appId}}function He(n){return gt.create("missing-app-config-values",{valueName:n})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xi="installations",ta="installations-internal",ea=n=>{const i=n.getProvider("app").getImmediate(),s=Qo(i),l=Ti(i,"heartbeat");return{app:i,appConfig:s,heartbeatServiceProvider:l,_delete:()=>Promise.resolve()}},na=n=>{const i=n.getProvider("app").getImmediate(),s=Ti(i,Xi).getImmediate();return{getId:()=>Jo(s),getToken:g=>Yo(s,g)}};function ia(){Ft(new bt(Xi,ea,"PUBLIC")),Ft(new bt(ta,na,"PRIVATE"))}ia();wt(Oi,Je);wt(Oi,Je,"esm2020");export{Aa as $,co as A,uo as B,bt as C,mo as D,Ge as E,Et as F,ga as G,Or as H,oo as I,Lr as J,da as K,rs as L,ao as M,fo as N,ra as O,aa as P,ma as Q,Hr as R,_a as S,Sa as T,ya as U,kr as V,lo as W,ho as X,vi as Y,Ai as Z,Ft as _,fa as a,Ra as a0,Oa as a1,Ks as a2,ua as b,Ta as c,Ca as d,Ia as e,O as f,sa as g,bi as h,la as i,Fe as j,xr as k,Ti as l,Pr as m,Da as n,$e as o,oa as p,wa as q,wt as r,pa as s,va as t,ha as u,ba as v,Ea as w,ca as x,go as y,po as z};

