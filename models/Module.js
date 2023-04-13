class Module {
    constructor(name,description){
        this.name = name;
        this.description = description;
    }
    displayModule(){
        console.log(`Name: ${this.name}`);
        console.log(`Description: ${this.description}`);
    }
}