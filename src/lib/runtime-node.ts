import { NodeServices } from "@effect/platform-node";
import { Layer, ManagedRuntime } from "effect";
import * as DkimNode from "@/domain/services/DkimNode";
import * as DnsNode from "@/domain/services/DnsNode";
import * as Env from "@/lib/env";

export const layers = Layer.mergeAll(
  Env.envLayer,
  NodeServices.layer,
  DkimNode.layer.pipe(Layer.provide(DnsNode.layer)),
);
export const runtimeNode = ManagedRuntime.make(layers);
