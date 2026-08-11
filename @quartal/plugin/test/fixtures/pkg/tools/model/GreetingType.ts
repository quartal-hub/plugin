/**
 * A type that represents a very complex greeting.
 */
export interface GreetingType {
  /** The name of the person to greet. */
  name: string;
  /** The age of the person to greet (number). */
  age: number;
  /** Example of a enum: The gender of the person to greet. */
  gender: "male" | "female";

  /** Example of an array of keywords. */
  keywords: string[];
}
