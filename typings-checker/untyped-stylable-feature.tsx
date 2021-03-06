import * as React from "react";
import {stylable} from "../dist/src/index";

interface CompProps {
    message: string;
}

// assume stylesheet is not typed
declare const style: any;

// $ExpectType (props: any) => Element
stylable(style)(props => {
    return <div/>;
});

// $ExpectType StatelessComponent<CompProps>
stylable(style)<React.SFC<CompProps>>(props => {
    return <div/>;
});

// $ExpectType (props: CompProps) => Element
stylable(style)((props: CompProps) => {
    return <div/>;
});
