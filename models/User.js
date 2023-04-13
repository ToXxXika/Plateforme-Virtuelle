class User {
    constructor( name, email, password,role)
    {
        this.name = name;
        this.email = email;
        this.password = password;
        this.role = role;
    }
    displayUser() {
        console.log(`Name: ${this.name}`);
        console.log(`Email: ${this.email}`);
    
    }
}