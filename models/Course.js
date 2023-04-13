class Course {
    constructor(title, instructor, duration, level, description,price,module) {
      this.title = title;
      this.instructor = instructor;
      this.duration = duration;
      this.level = level;
      this.description = description;
      this.price = price;
      this.module = module;
    }
  
    displayCourseInfo() {
      console.log(`Title: ${this.title}`);
      console.log(`Instructor: ${this.instructor}`);
      console.log(`Duration: ${this.duration}`);
      console.log(`Level: ${this.level}`);
      console.log(`Description: ${this.description}`);
      console.log(`Price: ${this.price}`);
      console.log(`Module: ${this.module}`);
    }
  }