import type { GreetingType } from "./model/GreetingType.ts";

/**
 * A class that says hello to the world.
 */
export class HelloWorld {
  /**
   * Say hello to the world.
   * @param input - The parameters.
   * @returns The greeting.
   */
  static sayHello(input: {
    /** The name to say hello to. */
    name?: string;
  }): string {
    return `Hello, ${input.name ?? "World"}!`;
  }

  /** Function with advanced parameters.
   * @param input Greeting fields (name, age, gender, keywords).
   */
  sayHelloAdvanced(input: GreetingType): string {
    return `Hello, ${input.name}! You are ${input.age} years old and your gender is ${input.gender}. Your keywords are ${
      input.keywords.join(", ")
    }.`;
  }

  /**
   * Function using this to access private method.
   * @param input - The parameters.
   * @returns The greeting.
   */
  sayHelloWithThis(input: {
    /** The name to say hello to. */
    name: string;
  }): string {
    return this.privateSayHello(input.name);
  }

  private privateSayHello(name: string): string {
    return `Hello with this, ${name}!`;
  }
}
