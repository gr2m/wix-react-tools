import {chain, Class, ClassDecorator, before, after as afterMethod} from "./class-decor";
import * as React from "react";
import {
    Attributes,
    CElement,
    ClassicComponent, ClassicComponentClass, ClassType, ComponentClass, ComponentState, DOMElement, HTMLAttributes,
    ReactElement,
    ReactHTML,
    ReactHTMLElement,
    ReactNode, ReactSVG, ReactSVGElement,
    SFC, SFCElement
} from "react";

import ReactCurrentOwner = require('react/lib/ReactCurrentOwner');
import {mix, MixedClass, MixerData} from "./mixer";

export type RenderResult = JSX.Element | null | false;
export type Rendered<P extends object> = {
    props: P;
    render(): RenderResult;
};

export type CreateElementArgs<P extends {}> = {
    type: ElementType<P>,
    props: Attributes & Partial<P>,
    children: Array<ReactNode>;
}

// TODO: make union based of all different overloaded signatures of createElement
// also consider <P extends HTMLAttributes<HTMLElement>>
export type CreateElementHook<T extends Rendered<any>> = <P  = object>(instance: T, args: CreateElementArgs<P>) => CreateElementArgs<P>;

export type ElementType<P> =
    keyof ReactHTML
    | keyof ReactSVG
    | string
    | SFC<P>
    | ComponentClass<P>
    | ClassType<P, ClassicComponent<P, ComponentState>, ClassicComponentClass<P>>;

export type ElementReturnType<P> =
    ReactHTMLElement<any>
    | ReactSVGElement
    | DOMElement<P, any>
    | SFCElement<P>
    | ReactElement<P>
    | CElement<P, ClassicComponent<P, ComponentState>>;

const original: typeof React.createElement = React.createElement;
// for root replication use React.cloneElement()

function cleanUpHook<P extends HTMLAttributes<HTMLElement>>(type: ElementType<P>, props: any, children: Array<ReactNode>) {
    (React as any).createElement = original;
    return original(type as any, props, ...children);
}

interface ReactMixerData<T extends Rendered<any>> extends MixerData<T> {
    createElementHooks: Array<CreateElementHook<T>>;
    lastRendering:T;
}

type ReactMixedClass<T extends Rendered<any>> = Class<T> & {$mixerData: ReactMixerData<T>};

function createElementProxy<T extends Rendered<any>, P extends HTMLAttributes<HTMLElement>>(
    this:ReactMixerData<T>, type: ElementType<P>, props: Attributes & Partial<P> = {}, ...children: Array<ReactNode>) {
    // check if original render is over, then clean up and call original
    if (ReactCurrentOwner.current && ReactCurrentOwner.current._instance === this.lastRendering) {
        let args: CreateElementArgs<P> = {type, props, children};
        this.createElementHooks.forEach((hook: CreateElementHook<T>) => {
            args = hook(this.lastRendering, args);
            if (args === undefined) {
                throw new Error('@registerForCreateElement Error: hook returned undefined');
            }
        });
        return original<Partial<P>>(args.type as any, args.props, ...args.children);
    } else {
        return cleanUpHook(type, props, children);
    }
}

function isReactMix<T extends Rendered<any>>(arg: MixedClass<T>): arg is ReactMixedClass<T> {
    return !!(arg as ReactMixedClass<T>).$mixerData.createElementHooks;
}

function initReactMix<T extends Rendered<any>>(hook: CreateElementHook<T>, mixed: MixedClass<T>) {
    const reactMixed = mixed as ReactMixedClass<T>;
    reactMixed.$mixerData.createElementHooks = [hook];
    const boundProxy = createElementProxy.bind(reactMixed.$mixerData);
    function reactDecorBeforeRenderHook(instance: T, args: never[]){
        reactMixed.$mixerData.lastRendering = instance;
        (React as any).createElement = boundProxy;
        return args;
    }
    return before(reactDecorBeforeRenderHook, 'render')(reactMixed);
}

export function registerForCreateElement<T extends Rendered<any>>(hook: CreateElementHook<T>): ClassDecorator<T> {
    return function registerForCreateElementDecorator<T1 extends T>(t: Class<T1>) {
        const mixed = mix(t);
        if (isReactMix(mixed)){
            mixed.$mixerData.createElementHooks.push(hook);
            return mixed;
        } else {
            return initReactMix<T1>(hook, mixed);
        }
    };
}