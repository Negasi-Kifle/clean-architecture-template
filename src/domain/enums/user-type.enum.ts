/**
 * What kind of principal a User row represents.
 *
 * A User is the identity/credentials record. `Employee` extends it with
 * staff-specific data (branch, employee number, job title). Adding a
 * `Customer` profile table later follows exactly the same pattern.
 */
export enum UserType {
    Employee = "Employee",
    Customer = "Customer",
}
